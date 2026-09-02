import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { DateTime } from "luxon";
import { db, client } from "../src/lib/db";
import { users, events, tasks, reminders } from "../src/lib/db/schema";

const TZ = "Asia/Kolkata";

async function main() {
  console.log("Seeding demo data...");

  const email = "demo@example.com";

  const passwordHash = await bcrypt.hash("password123", 10);
  const userId = nanoid();
  const now = DateTime.now().setZone(TZ);

  await db.insert(users)
    .values({
      id: userId,
      name: "Demo User",
      email,
      passwordHash,
      timezone: TZ,
      hourFormat: 24,
      weekStartsOn: "MONDAY",
      theme: "system",
      createdAt: now.toUTC().toISO() as string,
    })
    .run();

  // ---- Events ----
  const eventDefs = [
    { title: "Team Meeting", offsetDays: 0, startHour: 9, durationH: 1, status: "CONFIRMED", priority: "MEDIUM", location: "Conference Room A" },
    { title: "Doctor Appointment", offsetDays: 0, startHour: 14, durationH: 1, status: "CONFIRMED", priority: "HIGH", location: "City Clinic" },
    { title: "Project Review", offsetDays: 1, startHour: 11, durationH: 1.5, status: "PENDING", priority: "HIGH", location: "Zoom" },
    { title: "Gym", offsetDays: 1, startHour: 18, durationH: 1, status: "CONFIRMED", priority: "LOW", location: "FitZone Gym" },
    { title: "Client Call", offsetDays: 2, startHour: 16, durationH: 0.5, status: "CONFIRMED", priority: "HIGH", location: "Zoom" },
    { title: "Yesterday's Standup", offsetDays: -1, startHour: 9, durationH: 0.5, status: "COMPLETED", priority: "LOW", location: "Office" },
    { title: "Last Week Retro", offsetDays: -7, startHour: 15, durationH: 1, status: "COMPLETED", priority: "MEDIUM", location: "Office" },
  ];

  for (const e of eventDefs) {
    const start = now.plus({ days: e.offsetDays }).set({ hour: e.startHour, minute: 0, second: 0, millisecond: 0 });
    const end = start.plus({ hours: e.durationH });
    await db.insert(events)
      .values({
        id: nanoid(),
        userId,
        title: e.title,
        description: null,
        startTime: start.toUTC().toISO() as string,
        endTime: end.toUTC().toISO() as string,
        timezone: TZ,
        location: e.location,
        status: e.status as any,
        priority: e.priority as any,
        allDay: false,
        recurrence: "NONE",
        createdAt: now.toUTC().toISO() as string,
        updatedAt: now.toUTC().toISO() as string,
      })
      .run();
  }

  // A recurring weekly event
  {
    const start = now.set({ hour: 9, minute: 0, second: 0, millisecond: 0 }).plus({ days: (8 - now.weekday) % 7 || 7 });
    const end = start.plus({ hours: 1 });
    await db.insert(events)
      .values({
        id: nanoid(),
        userId,
        title: "Weekly Planning",
        description: "Recurring weekly planning session",
        startTime: start.toUTC().toISO() as string,
        endTime: end.toUTC().toISO() as string,
        timezone: TZ,
        location: "Office",
        status: "CONFIRMED",
        priority: "MEDIUM",
        allDay: false,
        recurrence: "WEEKLY",
        createdAt: now.toUTC().toISO() as string,
        updatedAt: now.toUTC().toISO() as string,
      })
      .run();
  }

  // ---- Tasks ----
  const taskDefs = [
    { title: "Finish Blockchain assignment", offsetDays: 0, hour: 23, status: "PENDING", priority: "HIGH" },
    { title: "Review notes", offsetDays: 1, hour: 20, status: "PENDING", priority: "MEDIUM" },
    { title: "Submit resume", offsetDays: 2, hour: 18, status: "PENDING", priority: "HIGH" },
    { title: "Complete project documentation", offsetDays: 3, hour: 17, status: "IN_PROGRESS", priority: "MEDIUM" },
    { title: "Pay credit card bill", offsetDays: -1, hour: 12, status: "PENDING", priority: "HIGH" }, // overdue
    { title: "Buy groceries", offsetDays: 0, hour: 19, status: "COMPLETED", priority: "LOW" },
    { title: "Read a chapter", offsetDays: -3, hour: 21, status: "COMPLETED", priority: "LOW" },
  ];

  for (const t of taskDefs) {
    const due = now.plus({ days: t.offsetDays }).set({ hour: t.hour, minute: 0, second: 0, millisecond: 0 });
    await db.insert(tasks)
      .values({
        id: nanoid(),
        userId,
        title: t.title,
        description: null,
        dueAt: due.toUTC().toISO() as string,
        timezone: TZ,
        status: t.status as any,
        priority: t.priority as any,
        completedAt: t.status === "COMPLETED" ? (now.toUTC().toISO() as string) : null,
        createdAt: now.toUTC().toISO() as string,
        updatedAt: now.toUTC().toISO() as string,
      })
      .run();
  }

  // ---- Reminders ----
  const reminderDefs = [
    { title: "Call Mom", offsetDays: 0, hour: 18, status: "PENDING" },
    { title: "Pay electricity bill", offsetDays: 2, hour: 10, status: "PENDING" },
    { title: "Submit application", offsetDays: 4, hour: 9, status: "PENDING" },
    { title: "Take medicine", offsetDays: -1, hour: 9, status: "COMPLETED" },
    { title: "Water the plants", offsetDays: -2, hour: 8, status: "DISMISSED" },
  ];

  for (const r of reminderDefs) {
    const at = now.plus({ days: r.offsetDays }).set({ hour: r.hour, minute: 0, second: 0, millisecond: 0 });
    await db.insert(reminders)
      .values({
        id: nanoid(),
        userId,
        title: r.title,
        description: null,
        remindAt: at.toUTC().toISO() as string,
        timezone: TZ,
        status: r.status as any,
        createdAt: now.toUTC().toISO() as string,
        updatedAt: now.toUTC().toISO() as string,
      })
      .run();
  }

  console.log("Seed complete.");
  console.log(`Demo login -> email: ${email}  password: password123`);
  client.close();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
