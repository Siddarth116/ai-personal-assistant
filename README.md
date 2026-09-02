# AI Personal Assistant

A full-stack productivity app: events, tasks, reminders, a unified schedule, and an AI assistant that can create, update, and retrieve any of them through natural language.

Built as a **single Next.js application** — no separate backend, no Postgres, no Docker. Everything runs locally with SQLite.

## What's actually here

This is a deliberately-scoped "core" build, prioritized around one thing: **understand a command, execute it, store it, and retrieve a correct timeline for any date range (past or future)**. That part is fully implemented, tested, and verified against a real running server. A few larger pieces described in an earlier full spec (drag-to-reschedule calendar UI, a full Playwright E2E suite, a command palette, native browser push notifications while the tab is closed) were intentionally left out or stubbed to keep this build real and working rather than partially fake. See "Known simplifications" below.

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **SQLite** via **better-sqlite3** (synchronous — avoids an entire class of async ORM lazy-loading bugs)
- **Drizzle ORM**
- **Zod** for validation
- Custom cookie-session auth (bcrypt password hashing) — simpler than wiring a full auth library for a local-first app, but real: hashed passwords, httpOnly signed session cookies, server-side session validation on every request
- **OpenAI SDK** with tool/function calling for the AI assistant
- **Vitest** for the service-layer test suite

## Quick start

```bash
npm install
cp .env.example .env      # already done if you're reading this in the built project
npm run db:migrate
npm run db:seed           # optional — creates a demo user with sample data
npm run dev
```

Open **http://localhost:3000**.

**Demo login** (after `db:seed`): `demo@example.com` / `password123`

### Enabling the AI assistant

The app runs completely fine without an OpenAI key — schedule, tasks, events, and reminders all work. To enable the AI assistant, add to `.env`:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini   # or any tool-calling-capable model
```

No key set → the assistant page shows "AI features are not configured" and every other part of the app keeps working, per spec.

## Project structure

```
src/
  app/
    (auth)/login, register        - auth pages
    dashboard/                    - summary cards + today/upcoming
    assistant/                    - AI chat UI
    schedule/                     - unified timeline, day/week, filters, search
    tasks/ reminders/ settings/
    api/                          - all route handlers (REST + chat)
  components/
    layout/  ui/  schedule/  assistant/  tasks/  reminders/  events/
  lib/
    db/            - Drizzle schema + client
    auth/           - session + password hashing
    services/       - eventService, taskService, reminderService, scheduleService
    ai/             - tool definitions, executor, system prompt, OpenAI client
    validations/    - Zod schemas
    utils/          - date/timezone helpers, error handling, cn()
drizzle/            - generated SQL migrations
scripts/            - migrate.ts, seed.ts
tests/              - Vitest suite (schedule aggregation)
```

## The unified schedule

There is no single `schedule` table. `getSchedule()` in `src/lib/services/scheduleService.ts` queries events, tasks, and reminders independently, normalizes them into one shape, and merges + sorts by time. This works identically for future dates, today, or years in the past — it's just a date-range query, not a "next N events" query.

**Status filtering is type-aware and never crashes.** `EVENT`, `TASK`, and `REMINDER` each have their own status enum (`CONFIRMED` is only valid for events, for example). If you filter `TASK` items by `status=CONFIRMED`, that's simply not a valid status for tasks — the endpoint returns an empty list for that type instead of throwing. This exact scenario is covered by an automated test.

## Running tests

```bash
npm test
```

15 tests cover the schedule aggregation service specifically, since that's the highest-risk part of this kind of app:

- 0 items / 1 event / 1 task / 1 reminder / all three together / many mixed items
- Cross-entity status filtering that must return empty, not crash (`TASK` + `CONFIRMED`)
- Per-type status filtering (`EVENT` + `CONFIRMED`, `TASK` + `COMPLETED`)
- Priority filtering (and reminders, which have no priority, correctly excluded)
- Free-text search across title/description
- Date range boundaries
- **Past date ranges**, not just future ones
- Timezone conversion correctness (IST input → correct UTC storage/retrieval)
- User data isolation (user A never sees user B's items)

## AI assistant

The assistant (`src/app/api/chat/route.ts`) runs a standard OpenAI tool-calling loop:

1. User message is saved, full conversation history is sent to the model along with a system prompt containing the user's **current time and timezone** (so "tomorrow at 6" resolves correctly).
2. If the model calls a tool (`createEvent`, `listTasks`, `getSchedule`, `updateReminder`, etc. — see `src/lib/ai/tools.ts` for the full list), the tool executes against the exact same service layer the REST API uses — the AI never touches the database directly.
3. Tool results go back to the model, which is allowed up to 6 iterations before it must produce a final text reply.
4. The reply is saved and returned.

The system prompt instructs the model to ask for missing critical details (e.g. no time given) rather than guessing, and to confirm before destructive actions unless the user was already explicit.

If the OpenAI call fails or the key is missing, the route returns a clean `503` with a readable message — it never crashes the app, and the rest of the UI is unaffected.

## Error handling

Every API route is wrapped in `withErrorHandling` (`src/lib/utils/apiResponse.ts`):

- Validation errors (Zod) → `422` with field details
- Auth errors → `401`
- Not-found → `404`
- Anything unexpected → logged server-side with the full stack trace, and a generic `"Something went wrong. Please try again."` is returned to the client — **never a raw exception**.

## Known simplifications

Kept intentionally out of scope so everything shipped here is real and tested, not scaffolded and untested:

- **Calendar drag-to-reschedule** — the Schedule page has day/week views, filtering, and search, but no drag-and-drop grid. Rescheduling works via edit or by asking the AI ("move my 4pm to 5pm").
- **Command palette (Cmd+K)** — not built. Quick Add (floating `+` button) covers the same "create anything from anywhere" need.
- **Native browser push notifications** — Settings has a "enable browser notifications" permission request wired up, but there's no background scheduler pushing notifications while the tab is closed (this generally requires a service worker + push server, out of scope for a local-first app per the original spec's own guidance to avoid this for v1).
- **Playwright E2E suite** — not included. The Vitest suite instead directly tests the highest-risk logic (schedule aggregation) at the service layer, and every user-facing flow (register → login → create event/task/reminder → verify in schedule → complete → delete) was manually verified against the running production build via the API.
- **Settings persistence** — the Settings page UI is complete and functional for reading current values, but the "Save changes" button doesn't yet persist profile/preference edits to the database (there's no `PATCH /api/settings` route). Timezone/hour-format used throughout the app currently reflect the value set at registration.

## Deploying to Vercel

The app's database layer uses `@libsql/client`, which works identically against a local file (for dev) or a hosted **Turso** database (for production) — no code changes needed between the two, only environment variables. Vercel's serverless functions don't have a persistent filesystem, so a local SQLite file won't survive between requests there; Turso solves that while staying 100% SQLite-compatible.

1. **Create a free Turso database**
   - Install the CLI: `curl -sSfL https://get.tur.so/install.sh | bash` (or see [turso.tech](https://turso.tech) for other install methods)
   - `turso auth login`
   - `turso db create ai-assistant`
   - `turso db show ai-assistant --url` → this is your `DATABASE_URL` (starts with `libsql://`)
   - `turso db tokens create ai-assistant` → this is your `DATABASE_AUTH_TOKEN`

2. **Apply migrations to the Turso database** (run once from your machine, pointed at the remote DB):
   ```bash
   DATABASE_URL="libsql://your-db-name.turso.io" DATABASE_AUTH_TOKEN="your-token" npm run db:migrate
   ```
   Optionally seed it the same way with `npm run db:seed` if you want demo data in production.

3. **Push the project to GitHub** (make sure `.env` is not committed — it's already in `.gitignore`).

4. **Import the repo in Vercel** (vercel.com → Add New → Project → import from GitHub). Vercel auto-detects Next.js, so the default build settings work as-is.

5. **Set environment variables** in the Vercel project's Settings → Environment Variables:
   - `DATABASE_URL` — your `libsql://...` URL from step 1
   - `DATABASE_AUTH_TOKEN` — your Turso token from step 1
   - `AUTH_SECRET` — any long random string
   - `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` — if you want the AI assistant enabled in production (works with either OpenAI or Google's Gemini via its OpenAI-compatible endpoint, see the `.env.example` comments)

6. **Deploy.** Vercel builds and gives you a public `https://your-project.vercel.app` URL — open that from your phone, from anywhere, no Wi-Fi restrictions.

Future schema changes: run `npm run db:generate` locally to create a new migration file, commit it, then run `npm run db:migrate` once against the Turso `DATABASE_URL`/`DATABASE_AUTH_TOKEN` before or after your next deploy.



- **`SQLITE_CANTOPEN` or missing `data/` folder**: the DB client creates `data/` automatically on first run, but if you deleted it mid-session, restart `npm run dev`.
- **`OPENAI_API_KEY` set but assistant still says "not configured"**: restart the dev server — env vars are only read on startup.
- **Port 3000 in use**: `npm run dev -- -p 3001`.
