import { describe, it, expect, beforeEach } from "vitest";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSchedule } from "@/lib/services/scheduleService";
import { createEvent } from "@/lib/services/eventService";
import { createTask } from "@/lib/services/taskService";
import { createReminder } from "@/lib/services/reminderService";

let userId: string;

beforeEach(async () => {
  userId = nanoid();
  await db.insert(users)
    .values({
      id: userId,
      name: "Test User",
      email: `${userId}@test.local`,
      passwordHash: "x",
    })
    .run();
});

const RANGE = { start: "2026-01-01T00:00:00.000Z", end: "2026-01-02T00:00:00.000Z" };

describe("getSchedule - unified timeline", () => {
  it("returns an empty array when the user has zero items", async () => {
    const result = await getSchedule(userId, RANGE);
    expect(result).toEqual([]);
  });

  it("returns a single event", async () => {
    await createEvent(userId, {
      title: "Team Meeting",
      startTime: "2026-01-01T09:00:00.000Z",
      endTime: "2026-01-01T10:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "CONFIRMED",
      priority: "MEDIUM",
      allDay: false,
      recurrence: "NONE",
    });
    const result = await getSchedule(userId, RANGE);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("EVENT");
    expect(result[0].title).toBe("Team Meeting");
  });

  it("returns a single task", async () => {
    await createTask(userId, {
      title: "Finish report",
      dueAt: "2026-01-01T11:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "PENDING",
      priority: "HIGH",
    });
    const result = await getSchedule(userId, RANGE);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("TASK");
  });

  it("returns a single reminder", async () => {
    await createReminder(userId, {
      title: "Call Mom",
      remindAt: "2026-01-01T18:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "PENDING",
    });
    const result = await getSchedule(userId, RANGE);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("REMINDER");
  });

  it("returns event + task + reminder together, sorted chronologically", async () => {
    await createReminder(userId, {
      title: "Call Mom",
      remindAt: "2026-01-01T18:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "PENDING",
    });
    await createEvent(userId, {
      title: "Team Meeting",
      startTime: "2026-01-01T09:00:00.000Z",
      endTime: "2026-01-01T10:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "CONFIRMED",
      priority: "MEDIUM",
      allDay: false,
      recurrence: "NONE",
    });
    await createTask(userId, {
      title: "Submit assignment",
      dueAt: "2026-01-01T11:30:00.000Z",
      timezone: "Asia/Kolkata",
      status: "PENDING",
      priority: "HIGH",
    });

    const result = await getSchedule(userId, RANGE);
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.type)).toEqual(["EVENT", "TASK", "REMINDER"]);
    // Chronological order regardless of type
    const times = result.map((i) => i.time);
    expect([...times].sort()).toEqual(times);
  });

  it("handles many mixed items without crashing", async () => {
    for (let i = 0; i < 5; i++) {
      await createEvent(userId, {
        title: `Event ${i}`,
        startTime: `2026-01-01T0${i}:00:00.000Z`,
        endTime: `2026-01-01T0${i}:30:00.000Z`,
        timezone: "Asia/Kolkata",
        status: "CONFIRMED",
        priority: "MEDIUM",
        allDay: false,
        recurrence: "NONE",
      });
    }
    for (let i = 0; i < 5; i++) {
      await createTask(userId, {
        title: `Task ${i}`,
        dueAt: `2026-01-01T1${i}:00:00.000Z`,
        timezone: "Asia/Kolkata",
        status: i % 2 === 0 ? "COMPLETED" : "PENDING",
        priority: "LOW",
      });
    }
    const result = await getSchedule(userId, RANGE);
    expect(result).toHaveLength(10);
  });

  it("NEVER crashes when filtering by a status that is only valid for a different entity type (e.g. TASK + CONFIRMED)", async () => {
    await createEvent(userId, {
      title: "Confirmed Event",
      startTime: "2026-01-01T09:00:00.000Z",
      endTime: "2026-01-01T10:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "CONFIRMED",
      priority: "MEDIUM",
      allDay: false,
      recurrence: "NONE",
    });
    await createTask(userId, {
      title: "Some task",
      dueAt: "2026-01-01T11:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "PENDING",
      priority: "MEDIUM",
    });

    // "CONFIRMED" is not a valid TASK status - filtering tasks by it must
    // yield zero task results, never throw.
    const result = await getSchedule(userId, { ...RANGE, types: ["TASK"], status: "CONFIRMED" });
    expect(result).toEqual([]);

    // But it's perfectly valid for events.
    const eventResult = await getSchedule(userId, { ...RANGE, types: ["EVENT"], status: "CONFIRMED" });
    expect(eventResult).toHaveLength(1);
  });

  it("filters EVENT + CONFIRMED to only confirmed events", async () => {
    await createEvent(userId, {
      title: "Confirmed",
      startTime: "2026-01-01T09:00:00.000Z",
      endTime: "2026-01-01T10:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "CONFIRMED",
      priority: "MEDIUM",
      allDay: false,
      recurrence: "NONE",
    });
    await createEvent(userId, {
      title: "Cancelled",
      startTime: "2026-01-01T09:00:00.000Z",
      endTime: "2026-01-01T10:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "CANCELLED",
      priority: "MEDIUM",
      allDay: false,
      recurrence: "NONE",
    });
    const result = await getSchedule(userId, { ...RANGE, types: ["EVENT"], status: "CONFIRMED" });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Confirmed");
  });

  it("filters TASK + COMPLETED to only completed tasks", async () => {
    await createTask(userId, {
      title: "Done",
      dueAt: "2026-01-01T11:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "COMPLETED",
      priority: "MEDIUM",
    });
    await createTask(userId, {
      title: "Not done",
      dueAt: "2026-01-01T11:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "PENDING",
      priority: "MEDIUM",
    });
    const result = await getSchedule(userId, { ...RANGE, types: ["TASK"], status: "COMPLETED" });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Done");
  });

  it("filters by priority across all types, since reminders now have priority too", async () => {
    await createEvent(userId, {
      title: "High priority event",
      startTime: "2026-01-01T09:00:00.000Z",
      endTime: "2026-01-01T10:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "CONFIRMED",
      priority: "HIGH",
      allDay: false,
      recurrence: "NONE",
    });
    await createReminder(userId, {
      title: "High priority reminder",
      remindAt: "2026-01-01T12:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "PENDING",
      priority: "HIGH",
    });
    await createReminder(userId, {
      title: "Low priority reminder",
      remindAt: "2026-01-01T13:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "PENDING",
      priority: "LOW",
    });
    const result = await getSchedule(userId, { ...RANGE, priority: "HIGH" });
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.type).sort()).toEqual(["EVENT", "REMINDER"]);
  });

  it("supports the URGENT priority tier across all types", async () => {
    await createTask(userId, {
      title: "Urgent task",
      dueAt: "2026-01-01T11:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "PENDING",
      priority: "URGENT",
    });
    const result = await getSchedule(userId, { ...RANGE, priority: "URGENT" });
    expect(result).toHaveLength(1);
    expect(result[0].priority).toBe("URGENT");
  });

  it("filters by search across title and description", async () => {
    await createTask(userId, {
      title: "Finish Blockchain assignment",
      dueAt: "2026-01-01T11:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "PENDING",
      priority: "MEDIUM",
    });
    await createTask(userId, {
      title: "Buy groceries",
      dueAt: "2026-01-01T12:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "PENDING",
      priority: "MEDIUM",
    });
    const result = await getSchedule(userId, { ...RANGE, search: "blockchain" });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Finish Blockchain assignment");
  });

  it("respects date range boundaries - excludes items outside the range", async () => {
    await createEvent(userId, {
      title: "Yesterday's event",
      startTime: "2025-12-31T09:00:00.000Z",
      endTime: "2025-12-31T10:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "CONFIRMED",
      priority: "MEDIUM",
      allDay: false,
      recurrence: "NONE",
    });
    await createEvent(userId, {
      title: "In range",
      startTime: "2026-01-01T09:00:00.000Z",
      endTime: "2026-01-01T10:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "CONFIRMED",
      priority: "MEDIUM",
      allDay: false,
      recurrence: "NONE",
    });
    const result = await getSchedule(userId, RANGE);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("In range");
  });

  it("supports past date ranges just like future ones", async () => {
    await createEvent(userId, {
      title: "Past event",
      startTime: "2020-06-15T09:00:00.000Z",
      endTime: "2020-06-15T10:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "COMPLETED",
      priority: "MEDIUM",
      allDay: false,
      recurrence: "NONE",
    });
    const result = await getSchedule(userId, {
      start: "2020-06-15T00:00:00.000Z",
      end: "2020-06-16T00:00:00.000Z",
    });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Past event");
  });

  it("converts local-timezone input correctly to UTC for storage and retrieval", async () => {
    // 6 PM IST on Jan 1 2026 = 12:30 UTC
    await createReminder(userId, {
      title: "Call Mom",
      remindAt: "2026-01-01T18:00:00+05:30",
      timezone: "Asia/Kolkata",
      status: "PENDING",
    });
    const result = await getSchedule(userId, RANGE);
    expect(result).toHaveLength(1);
    expect(result[0].time).toBe("2026-01-01T12:30:00.000Z");
  });

  it("never lets one user see another user's items", async () => {
    const otherUserId = nanoid();
    await db.insert(users)
      .values({ id: otherUserId, name: "Other", email: `${otherUserId}@test.local`, passwordHash: "x" })
      .run();

    await createEvent(otherUserId, {
      title: "Other user's event",
      startTime: "2026-01-01T09:00:00.000Z",
      endTime: "2026-01-01T10:00:00.000Z",
      timezone: "Asia/Kolkata",
      status: "CONFIRMED",
      priority: "MEDIUM",
      allDay: false,
      recurrence: "NONE",
    });

    const result = await getSchedule(userId, RANGE);
    expect(result).toEqual([]);
  });
});
