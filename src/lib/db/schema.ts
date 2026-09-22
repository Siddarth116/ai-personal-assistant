import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
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
  notificationsEnabled: integer("notifications_enabled", { mode: "boolean" }).notNull().default(true),
  // Minutes of advance warning before an item's time. 0 disables the advance
  // notification entirely (the at-the-exact-time notification always fires
  // regardless, as long as notificationsEnabled is true).
  notificationLeadMinutes: integer("notification_lead_minutes").notNull().default(15),
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
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
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
  priority: text("priority", { enum: PRIORITIES }).notNull().default("MEDIUM"),
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

// ---------------------------------------------------------------------------
// Web Push - real push delivery, works even when no tab is open (unlike the
// client-side NotificationScheduler, which only runs while a tab is active).
// ---------------------------------------------------------------------------

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  authKey: text("auth_key").notNull(),
  // A human-readable label (e.g. derived from the browser's user agent) shown
  // in Settings so the user can tell which of their devices a subscription is.
  label: text("label"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// Tracks which (user, item occurrence, kind) combinations have already had a
// push sent for them, persisted server-side so it survives across separate
// cron invocations (unlike the client scheduler's localStorage-based dedup).
export const sentPushNotifications = sqliteTable("sent_push_notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull(), // EVENT | TASK | REMINDER
  itemId: text("item_id").notNull(),
  itemTime: text("item_time").notNull(), // the specific occurrence's UTC ISO time - see notifications/scheduler.ts for why this matters for recurring events
  kind: text("kind").notNull(), // "lead" | "exact"
  sentAt: text("sent_at")
    .notNull()
    .default(sql`(current_timestamp)`),
}, (table) => ({
  uniqueTrigger: uniqueIndex("sent_push_unique_trigger").on(
    table.userId,
    table.itemType,
    table.itemId,
    table.itemTime,
    table.kind
  ),
}));

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type SentPushNotification = typeof sentPushNotifications.$inferSelect;
