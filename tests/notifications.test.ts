import { describe, it, expect } from "vitest";
import { computeNotificationsToFire, type NotifiableItem } from "@/lib/notifications/scheduler";

const item = (overrides: Partial<NotifiableItem> = {}): NotifiableItem => ({
  id: "item-1",
  type: "EVENT",
  title: "Test Event",
  time: "2026-01-01T12:00:00.000Z",
  ...overrides,
});

describe("computeNotificationsToFire", () => {
  it("fires the exact-time notification the instant the item's time is reached", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const result = computeNotificationsToFire([item()], now, 15, new Set());
    expect(result.some((r) => r.kind === "exact")).toBe(true);
  });

  it("fires the lead-time notification exactly leadMinutes before the item's time", () => {
    const now = new Date("2026-01-01T11:45:00.000Z"); // 15 min before
    const result = computeNotificationsToFire([item()], now, 15, new Set());
    expect(result.some((r) => r.kind === "lead")).toBe(true);
    expect(result.some((r) => r.kind === "exact")).toBe(false);
  });

  it("does not fire anything well before either trigger point", () => {
    const now = new Date("2026-01-01T10:00:00.000Z"); // 2 hours before, lead is only 15 min
    const result = computeNotificationsToFire([item()], now, 15, new Set());
    expect(result).toHaveLength(0);
  });

  it("does not fire anything well after both trigger points have passed the detection window", () => {
    const now = new Date("2026-01-01T13:00:00.000Z"); // 1 hour after
    const result = computeNotificationsToFire([item()], now, 15, new Set(), 60_000);
    expect(result).toHaveLength(0);
  });

  it("never fires the lead notification when leadMinutes is 0", () => {
    const now = new Date("2026-01-01T11:45:00.000Z");
    const result = computeNotificationsToFire([item()], now, 0, new Set());
    expect(result.some((r) => r.kind === "lead")).toBe(false);
  });

  it("still fires the exact-time notification when leadMinutes is 0", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const result = computeNotificationsToFire([item()], now, 0, new Set());
    expect(result.some((r) => r.kind === "exact")).toBe(true);
  });

  it("does not re-fire a notification whose key is already in alreadyNotifiedKeys", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const key = `EVENT:item-1:${item().time}:exact`;
    const result = computeNotificationsToFire([item()], now, 15, new Set([key]));
    expect(result.some((r) => r.kind === "exact")).toBe(false);
  });

  it("CRITICAL: fires separately for each occurrence of a recurring item sharing the same id", () => {
    // Two different weekly occurrences of the "same" recurring event id -
    // this is exactly how the schedule service represents recurrence.
    // Without time being part of the dedup key, only the first would ever notify.
    const occurrence1 = item({ id: "recurring-1", time: "2026-01-05T12:00:00.000Z" });
    const occurrence2 = item({ id: "recurring-1", time: "2026-01-12T12:00:00.000Z" });

    const alreadyNotified = new Set([`EVENT:recurring-1:${occurrence1.time}:exact`]);

    const now = new Date("2026-01-12T12:00:00.000Z");
    const result = computeNotificationsToFire([occurrence1, occurrence2], now, 15, alreadyNotified);

    // occurrence1 was already notified (and isn't due anyway - it's in the past),
    // but occurrence2, despite sharing the same id, must still fire.
    expect(result.some((r) => r.item.time === occurrence2.time && r.kind === "exact")).toBe(true);
    expect(result.some((r) => r.item.time === occurrence1.time)).toBe(false);
  });

  it("handles multiple distinct items independently in one pass", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const items = [
      item({ id: "a", time: "2026-01-01T12:00:00.000Z" }), // exact now
      item({ id: "b", time: "2026-01-01T12:15:00.000Z" }), // lead (15 min out)
      item({ id: "c", time: "2026-01-02T12:00:00.000Z" }), // way in the future, nothing yet
    ];
    const result = computeNotificationsToFire(items, now, 15, new Set());
    expect(result.find((r) => r.item.id === "a")?.kind).toBe("exact");
    expect(result.find((r) => r.item.id === "b")?.kind).toBe("lead");
    expect(result.find((r) => r.item.id === "c")).toBeUndefined();
  });

  it("ignores items with an unparseable time instead of crashing", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const badItem = item({ time: "not-a-real-date" });
    expect(() => computeNotificationsToFire([badItem], now, 15, new Set())).not.toThrow();
    expect(computeNotificationsToFire([badItem], now, 15, new Set())).toHaveLength(0);
  });

  it("works identically across event, task, and reminder types", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const items = [
      item({ id: "e1", type: "EVENT" }),
      item({ id: "t1", type: "TASK" }),
      item({ id: "r1", type: "REMINDER" }),
    ];
    const result = computeNotificationsToFire(items, now, 15, new Set());
    expect(result).toHaveLength(3);
  });
});
