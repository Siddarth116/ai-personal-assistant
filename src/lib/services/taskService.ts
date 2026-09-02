import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { tasks, type Task } from "@/lib/db/schema";
import { createTaskSchema, updateTaskSchema } from "@/lib/validations";
import { NotFoundError } from "@/lib/utils/errors";
import { toUtcIso, nowIso } from "@/lib/utils/date";
import { z } from "zod";

export async function createTask(userId: string, input: z.input<typeof createTaskSchema>): Promise<Task> {
  const data = createTaskSchema.parse(input);
  const id = nanoid();
  const now = nowIso();

  const row: typeof tasks.$inferInsert = {
    id,
    userId,
    title: data.title,
    description: data.description ?? null,
    dueAt: data.dueAt ? toUtcIso(data.dueAt) : null,
    timezone: data.timezone,
    status: data.status,
    priority: data.priority,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(tasks).values(row).run();
  return getTask(userId, id);
}

export async function getTask(userId: string, id: string): Promise<Task> {
  const row = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .get();
  if (!row) throw new NotFoundError("Task not found");
  return row;
}

export async function listTasks(
  userId: string,
  filters: { status?: string; priority?: string } = {}
): Promise<Task[]> {
  let rows = await db.select().from(tasks).where(eq(tasks.userId, userId)).all();
  if (filters.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters.priority) rows = rows.filter((r) => r.priority === filters.priority);
  return rows;
}

export async function updateTask(
  userId: string,
  id: string,
  input: Partial<z.infer<typeof updateTaskSchema>>
): Promise<Task> {
  await getTask(userId, id);
  const data = updateTaskSchema.parse(input);

  const patch: Partial<typeof tasks.$inferInsert> = { ...data, updatedAt: nowIso() };
  if (data.dueAt) patch.dueAt = toUtcIso(data.dueAt);
  if (data.status === "COMPLETED") patch.completedAt = nowIso();
  if (data.status && data.status !== "COMPLETED") patch.completedAt = null;

  await db.update(tasks).set(patch).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).run();
  return getTask(userId, id);
}

export async function completeTask(userId: string, id: string): Promise<Task> {
  return updateTask(userId, id, { status: "COMPLETED" });
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  await getTask(userId, id);
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).run();
}
