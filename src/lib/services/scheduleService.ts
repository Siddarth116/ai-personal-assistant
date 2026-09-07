import { and, eq, ne, or, lt, gt, gte, lte } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { events, tasks, reminders, EVENT_STATUSES, TASK_STATUSES, REMINDER_STATUSES, PRIORITIES } from "@/lib/db/schema";
import { expandOccurrences } from "@/lib/utils/recurrence";

export type ScheduleItemType = "EVENT" | "TASK" | "REMINDER";

export interface ScheduleItem {
  id: string;
  type: ScheduleItemType;
  title: string;
  description: string | null;
  /** The instant used to place this item on the timeline (UTC ISO). */
  time: string;
  /** Only events have a distinct end time. */
  endTime: string | null;
  status: string;
  priority: string | null;
  timezone: string;
  location: string | null;
  /** "NONE" for tasks/reminders/non-repeating events; otherwise the repeat pattern. */
  recurrence: string | null;
}

export interface ScheduleFilters {
  start: string; // UTC ISO
  end: string; // UTC ISO
  types?: ScheduleItemType[];
  status?: string;
  priority?: string;
  search?: string;
}

const EVENT_STATUS_SET = new Set<string>(EVENT_STATUSES);
const TASK_STATUS_SET = new Set<string>(TASK_STATUSES);
const REMINDER_STATUS_SET = new Set<string>(REMINDER_STATUSES);
const PRIORITY_SET = new Set<string>(PRIORITIES);

/**
 * IMPORTANT: status values are NOT shared across entity types.
 * "CONFIRMED" only ever means anything for events; "COMPLETED" means
 * something different (and valid) for both tasks and reminders. We never
 * attempt to cast a status string into another entity's enum. Instead, for
 * each entity type we check membership in that type's own valid-status set.
 * If the requested status isn't valid for a given type, that type simply
 * contributes zero items to the result - it never throws or 500s.
 */
function statusAppliesTo(status: string | undefined, validSet: Set<string>): boolean | "skip-filter" {
  if (!status) return "skip-filter"; // no status filter requested at all
  return validSet.has(status);
}

export async function getSchedule(userId: string, filters: ScheduleFilters): Promise<ScheduleItem[]> {
  const { start, end, types, status, priority, search } = filters;
  const wantTypes = new Set<ScheduleItemType>(types && types.length > 0 ? types : ["EVENT", "TASK", "REMINDER"]);

  const items: ScheduleItem[] = [];

  // ---- Events: include if a *concrete occurrence* of the event overlaps [start, end].
  // Non-recurring events: the single stored [startTime, endTime] must overlap.
  // Recurring events: any anchor whose start is not after the range end could still
  // produce a future occurrence inside the range, so we fetch those broadly and let
  // expandOccurrences() compute the real overlapping occurrence dates.
  if (wantTypes.has("EVENT")) {
    const statusCheck = statusAppliesTo(status, EVENT_STATUS_SET);
    if (statusCheck !== false) {
      let rows = await db
        .select()
        .from(events)
        .where(
          and(
            eq(events.userId, userId),
            or(
              and(eq(events.recurrence, "NONE"), lt(events.startTime, end), gt(events.endTime, start)),
              and(ne(events.recurrence, "NONE"), lte(events.startTime, end))
            )
          )
        )
        .all();

      if (statusCheck === true && status) rows = rows.filter((e) => e.status === status);
      if (priority && PRIORITY_SET.has(priority)) rows = rows.filter((e) => e.priority === priority);
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            (e.description ?? "").toLowerCase().includes(q) ||
            (e.location ?? "").toLowerCase().includes(q)
        );
      }

      const rangeStartDT = DateTime.fromISO(start, { zone: "utc" });
      const rangeEndDT = DateTime.fromISO(end, { zone: "utc" });

      for (const e of rows) {
        const anchorStart = DateTime.fromISO(e.startTime, { zone: "utc" });
        const anchorEnd = DateTime.fromISO(e.endTime, { zone: "utc" });
        const occurrences = expandOccurrences(anchorStart, anchorEnd, e.recurrence, rangeStartDT, rangeEndDT);

        for (const occ of occurrences) {
          items.push({
            id: e.id,
            type: "EVENT",
            title: e.title,
            description: e.description,
            time: occ.start.toUTC().toISO() as string,
            endTime: occ.end.toUTC().toISO() as string,
            status: e.status,
            priority: e.priority,
            timezone: e.timezone,
            location: e.location,
            recurrence: e.recurrence,
          });
        }
      }
    }
  }

  // ---- Tasks: include if dueAt falls in range. Undated tasks are excluded from timeline ranges. ----
  if (wantTypes.has("TASK")) {
    const statusCheck = statusAppliesTo(status, TASK_STATUS_SET);
    if (statusCheck !== false) {
      let rows = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, userId), gte(tasks.dueAt, start), lte(tasks.dueAt, end)))
        .all();

      if (statusCheck === true && status) rows = rows.filter((t) => t.status === status);
      if (priority && PRIORITY_SET.has(priority)) rows = rows.filter((t) => t.priority === priority);
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(
          (t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q)
        );
      }

      for (const t of rows) {
        if (!t.dueAt) continue;
        items.push({
          id: t.id,
          type: "TASK",
          title: t.title,
          description: t.description,
          time: t.dueAt,
          endTime: null,
          status: t.status,
          priority: t.priority,
          timezone: t.timezone,
          location: null,
          recurrence: null,
        });
      }
    }
  }

  // ---- Reminders: include if remindAt falls in range ----
  if (wantTypes.has("REMINDER")) {
    const statusCheck = statusAppliesTo(status, REMINDER_STATUS_SET);
    if (statusCheck !== false) {
      let rows = await db
        .select()
        .from(reminders)
        .where(and(eq(reminders.userId, userId), gte(reminders.remindAt, start), lte(reminders.remindAt, end)))
        .all();

      if (statusCheck === true && status) rows = rows.filter((r) => r.status === status);
      if (priority && PRIORITY_SET.has(priority)) rows = rows.filter((r) => r.priority === priority);
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(
          (r) => r.title.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q)
        );
      }

      for (const r of rows) {
        items.push({
          id: r.id,
          type: "REMINDER",
          title: r.title,
          description: r.description,
          time: r.remindAt,
          endTime: null,
          status: r.status,
          priority: r.priority,
          timezone: r.timezone,
          location: null,
          recurrence: null,
        });
      }
    }
  }

  items.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  return items;
}
