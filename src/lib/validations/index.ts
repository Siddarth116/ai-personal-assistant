import { z } from "zod";
import { EVENT_STATUSES, PRIORITIES, RECURRENCE_TYPES, TASK_STATUSES, REMINDER_STATUSES } from "@/lib/db/schema";

const isoDateTime = z.string().refine(
  (v) => !isNaN(Date.parse(v)),
  { message: "Must be a valid ISO 8601 date-time string" }
);

export const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  startTime: isoDateTime,
  endTime: isoDateTime,
  timezone: z.string().default("Asia/Kolkata"),
  location: z.string().max(300).optional().nullable(),
  status: z.enum(EVENT_STATUSES).default("CONFIRMED"),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  allDay: z.boolean().default(false),
  recurrence: z.enum(RECURRENCE_TYPES).default("NONE"),
});

export const updateEventSchema = createEventSchema.partial();

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  dueAt: isoDateTime.optional().nullable(),
  timezone: z.string().default("Asia/Kolkata"),
  status: z.enum(TASK_STATUSES).default("PENDING"),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
});

export const updateTaskSchema = createTaskSchema.partial();

export const createReminderSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  remindAt: isoDateTime,
  timezone: z.string().default("Asia/Kolkata"),
  status: z.enum(REMINDER_STATUSES).default("PENDING"),
});

export const updateReminderSchema = createReminderSchema.partial();

export const scheduleQuerySchema = z.object({
  start: isoDateTime,
  end: isoDateTime,
  types: z.array(z.enum(["EVENT", "TASK", "REMINDER"])).optional(),
  // Status is intentionally a free string here, not a shared enum - see
  // scheduleService for why cross-entity enum coercion is never attempted.
  status: z.string().optional(),
  priority: z.enum(PRIORITIES).optional(),
  search: z.string().optional(),
});

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
