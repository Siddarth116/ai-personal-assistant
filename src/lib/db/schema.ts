import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Users & sessions
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  hourFormat: integer("hour_format").notNull().default(24), // 12 or 24
  weekStartsOn: text("week_starts_on").notNull().default("MONDAY"), // MONDAY | SUNDAY
  theme: text("theme").notNull().default("system"), // light | dark | system
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // session token
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const EVENT_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const RECURRENCE_TYPES = ["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  startTime: text("start_time").notNull(), // ISO 8601 UTC
  endTime: text("end_time").notNull(), // ISO 8601 UTC
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  location: text("location"),
  status: text("status", { enum: EVENT_STATUSES }).notNull().default("CONFIRMED"),
  priority: text("priority", { enum: PRIORITIES }).notNull().default("MEDIUM"),
  allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
  recurrence: text("recurrence", { enum: RECURRENCE_TYPES }).notNull().default("NONE"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueAt: text("due_at"), // ISO 8601 UTC, nullable (tasks can be undated)
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  status: text("status", { enum: TASK_STATUSES }).notNull().default("PENDING"),
  priority: text("priority", { enum: PRIORITIES }).notNull().default("MEDIUM"),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export const REMINDER_STATUSES = ["PENDING", "COMPLETED", "DISMISSED", "CANCELLED"] as const;

export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  remindAt: text("remind_at").notNull(), // ISO 8601 UTC
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  status: text("status", { enum: REMINDER_STATUSES }).notNull().default("PENDING"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// ---------------------------------------------------------------------------
// Chat (AI conversations)
// ---------------------------------------------------------------------------

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New conversation"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const MESSAGE_ROLES = ["USER", "ASSISTANT", "TOOL"] as const;

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: MESSAGE_ROLES }).notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export type User = typeof users.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
