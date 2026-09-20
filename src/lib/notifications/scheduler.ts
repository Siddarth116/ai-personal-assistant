export type NotificationKind = "lead" | "exact";

export interface NotifiableItem {
  id: string;
  type: "EVENT" | "TASK" | "REMINDER";
  title: string;
  /** UTC ISO instant this item is scheduled for. */
  time: string;
}

export interface PendingNotification {
  /** Unique per item OCCURRENCE and kind - see note below on why time is part of the key. */
  key: string;
  item: NotifiableItem;
  kind: NotificationKind;
}

/**
 * Decides which notifications should fire right now, given the current time,
 * the user's lead-time preference, and which (item, occurrence, kind)
 * combinations have already been notified.
 *
 * This is deliberately a pure function with no browser/React dependencies,
 * so the actual timing logic - the part most worth getting right - can be
 * unit tested directly without mocking the Notification API, fetch, or a
 * component tree.
 *
 * IMPORTANT: recurring events share the same `id` across every occurrence
 * (the schedule service expands one recurring row into many virtual
 * occurrences at query time - see scheduleService.ts). If the dedup key only
 * used `type:id`, a weekly class would only ever notify once, ever, on its
 * very first occurrence, and silently never again. The key includes the
 * occurrence's own `time` specifically so each week's instance is distinct.
 */
export function computeNotificationsToFire(
  items: NotifiableItem[],
  now: Date,
  leadMinutes: number,
  alreadyNotifiedKeys: ReadonlySet<string>,
  /** How far back from `now` counts as "just crossed" - should be >= the poll interval so no trigger is missed between polls. */
  windowMs: number = 60_000
): PendingNotification[] {
  const results: PendingNotification[] = [];
  const nowMs = now.getTime();

  const justCrossed = (triggerMs: number) => triggerMs <= nowMs && triggerMs > nowMs - windowMs;

  for (const item of items) {
    const itemMs = new Date(item.time).getTime();
    if (Number.isNaN(itemMs)) continue;

    const exactKey = `${item.type}:${item.id}:${item.time}:exact`;
    if (justCrossed(itemMs) && !alreadyNotifiedKeys.has(exactKey)) {
      results.push({ key: exactKey, item, kind: "exact" });
    }

    if (leadMinutes > 0) {
      const leadMs = itemMs - leadMinutes * 60_000;
      const leadKey = `${item.type}:${item.id}:${item.time}:lead`;
      if (justCrossed(leadMs) && !alreadyNotifiedKeys.has(leadKey)) {
        results.push({ key: leadKey, item, kind: "lead" });
      }
    }
  }

  return results;
}
