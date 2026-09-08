import { DateTime } from "luxon";

export function fmt(isoUtc: string, timezone: string, format = "d LLL, h:mm a"): string {
  const dt = DateTime.fromISO(isoUtc, { zone: "utc" }).setZone(timezone);
  return dt.isValid ? dt.toFormat(format) : isoUtc;
}

export function fmtTime(isoUtc: string, timezone: string, hour24 = false): string {
  return fmt(isoUtc, timezone, hour24 ? "HH:mm" : "h:mm a");
}

export function fmtDay(isoUtc: string, timezone: string): string {
  return fmt(isoUtc, timezone, "ccc, d LLL yyyy");
}

export function relativeDay(isoUtc: string, timezone: string): string {
  const dt = DateTime.fromISO(isoUtc, { zone: "utc" }).setZone(timezone).startOf("day");
  const today = DateTime.now().setZone(timezone).startOf("day");
  const diff = dt.diff(today, "days").days;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return dt.toFormat("ccc, d LLL");
}

/** Convert a <input type="datetime-local"> value + timezone into an ISO string with offset. */
export function localInputToIso(localValue: string, timezone: string): string {
  const dt = DateTime.fromISO(localValue, { zone: timezone });
  return dt.toISO() as string;
}

/** Convert a UTC ISO string into a value usable by <input type="datetime-local">. */
export function isoToLocalInput(isoUtc: string, timezone: string): string {
  const dt = DateTime.fromISO(isoUtc, { zone: "utc" }).setZone(timezone);
  return dt.toFormat("yyyy-LL-dd'T'HH:mm");
}

/** Calendar-day key (YYYY-MM-DD) in the given timezone - used to group schedule items by day. */
export function dayKey(isoUtc: string, timezone: string): string {
  return DateTime.fromISO(isoUtc, { zone: "utc" }).setZone(timezone).toFormat("yyyy-LL-dd");
}

export interface DayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/**
 * Groups a chronologically-sorted list of items (each with a `.time` field,
 * a UTC ISO string) into calendar-day buckets in the user's timezone, with
 * a human label ("Today", "Tomorrow", or a formatted date) per bucket.
 * Assumes the input is already sorted by time - preserves that order both
 * across and within groups.
 */
export function groupByDay<T extends { time: string }>(items: T[], timezone: string): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of items) {
    const key = dayKey(item.time, timezone);
    let idx = indexByKey.get(key);
    if (idx === undefined) {
      idx = groups.length;
      indexByKey.set(key, idx);
      groups.push({ key, label: relativeDay(item.time, timezone), items: [] });
    }
    groups[idx].items.push(item);
  }

  return groups;
}
