import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { reminders, type Reminder } from "@/lib/db/schema";
import { createReminderSchema, updateReminderSchema } from "@/lib/validations";
import { NotFoundError } from "@/lib/utils/errors";
import { toUtcIso, nowIso } from "@/lib/utils/date";
import { z } from "zod";

export async function createReminder(
  userId: string,
  input: z.input<typeof createReminderSchema>
): Promise<Reminder> {
  const data = createReminderSchema.parse(input);
  const id = nanoid();
  const now = nowIso();

  const row: typeof reminders.$inferInsert = {
    id,
    userId,
    title: data.title,
    description: data.description ?? null,
    remindAt: toUtcIso(data.remindAt),
    timezone: data.timezone,
    status: data.status,
    priority: data.priority,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(reminders).values(row).run();
  return getReminder(userId, id);
}

export async function getReminder(userId: string, id: string): Promise<Reminder> {
  const row = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)))
    .get();
  if (!row) throw new NotFoundError("Reminder not found");
  return row;
}

export async function listReminders(
  userId: string,
  filters: { status?: string; priority?: string } = {}
): Promise<Reminder[]> {
  let rows = await db.select().from(reminders).where(eq(reminders.userId, userId)).all();
  if (filters.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters.priority) rows = rows.filter((r) => r.priority === filters.priority);
  return rows;
}

export async function updateReminder(
  userId: string,
  id: string,
  input: Partial<z.infer<typeof updateReminderSchema>>
): Promise<Reminder> {
  await getReminder(userId, id);
  const data = updateReminderSchema.parse(input);

  const patch: Partial<typeof reminders.$inferInsert> = { ...data, updatedAt: nowIso() };
  if (data.remindAt) patch.remindAt = toUtcIso(data.remindAt);

  await db.update(reminders).set(patch).where(and(eq(reminders.id, id), eq(reminders.userId, userId))).run();
  return getReminder(userId, id);
}

export async function dismissReminder(userId: string, id: string): Promise<Reminder> {
  return updateReminder(userId, id, { status: "DISMISSED" });
}

export async function completeReminder(userId: string, id: string): Promise<Reminder> {
  return updateReminder(userId, id, { status: "COMPLETED" });
}

export async function deleteReminder(userId: string, id: string): Promise<void> {
  await getReminder(userId, id);
  await db.delete(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, userId))).run();
}
