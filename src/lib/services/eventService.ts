import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { events, type Event } from "@/lib/db/schema";
import { createEventSchema, updateEventSchema } from "@/lib/validations";
import { NotFoundError } from "@/lib/utils/errors";
import { toUtcIso, nowIso } from "@/lib/utils/date";
import { z } from "zod";

export async function createEvent(userId: string, input: z.input<typeof createEventSchema>): Promise<Event> {
  const data = createEventSchema.parse(input);
  const id = nanoid();
  const now = nowIso();

  const row: typeof events.$inferInsert = {
    id,
    userId,
    title: data.title,
    description: data.description ?? null,
    startTime: toUtcIso(data.startTime),
    endTime: toUtcIso(data.endTime),
    timezone: data.timezone,
    location: data.location ?? null,
    status: data.status,
    priority: data.priority,
    allDay: data.allDay,
    recurrence: data.recurrence,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(events).values(row).run();
  return getEvent(userId, id);
}

export async function getEvent(userId: string, id: string): Promise<Event> {
  const row = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .get();
  if (!row) throw new NotFoundError("Event not found");
  return row;
}

export async function listEvents(
  userId: string,
  filters: { status?: string; priority?: string } = {}
): Promise<Event[]> {
  let rows = await db.select().from(events).where(eq(events.userId, userId)).all();
  if (filters.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters.priority) rows = rows.filter((r) => r.priority === filters.priority);
  return rows;
}

export async function updateEvent(
  userId: string,
  id: string,
  input: Partial<z.infer<typeof updateEventSchema>>
): Promise<Event> {
  await getEvent(userId, id); // ensures ownership + existence
  const data = updateEventSchema.parse(input);

  const patch: Partial<typeof events.$inferInsert> = { ...data, updatedAt: nowIso() };
  if (data.startTime) patch.startTime = toUtcIso(data.startTime);
  if (data.endTime) patch.endTime = toUtcIso(data.endTime);

  await db.update(events).set(patch).where(and(eq(events.id, id), eq(events.userId, userId))).run();
  return getEvent(userId, id);
}

export async function deleteEvent(userId: string, id: string): Promise<void> {
  await getEvent(userId, id);
  await db.delete(events).where(and(eq(events.id, id), eq(events.userId, userId))).run();
}
