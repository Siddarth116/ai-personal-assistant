import { DateTime } from "luxon";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/** Current time as an ISO string in UTC - the canonical "now" for the app. */
export function nowIso(): string {
  return DateTime.utc().toISO() as string;
}

/** Current time rendered in a given IANA timezone, for showing the AI "what time is it". */
export function nowInTimezone(timezone: string): string {
  return DateTime.now().setZone(timezone).toISO() as string;
}

/** Parse any ISO-ish string into a UTC ISO string. Throws on invalid input. */
export function toUtcIso(input: string): string {
  const dt = DateTime.fromISO(input, { setZone: true });
  if (!dt.isValid) {
    throw new Error(`Invalid date/time: "${input}" (${dt.invalidReason})`);
  }
  return dt.toUTC().toISO() as string;
}

/** Format a UTC ISO string for display in the user's timezone. */
export function formatInTimezone(
  isoUtc: string,
  timezone: string,
  format: string = "ccc, dd LLL yyyy 'at' HH:mm"
): string {
  return DateTime.fromISO(isoUtc, { zone: "utc" }).setZone(timezone).toFormat(format);
}

/** Start/end of "today" in the user's timezone, expressed as UTC ISO strings. */
export function todayRange(timezone: string): { start: string; end: string } {
  const now = DateTime.now().setZone(timezone);
  return {
    start: now.startOf("day").toUTC().toISO() as string,
    end: now.endOf("day").toUTC().toISO() as string,
  };
}

/** Start/end of the next N days (including today) in the user's timezone. */
export function upcomingRange(timezone: string, days = 7): { start: string; end: string } {
  const now = DateTime.now().setZone(timezone);
  return {
    start: now.startOf("day").toUTC().toISO() as string,
    end: now.plus({ days }).endOf("day").toUTC().toISO() as string,
  };
}
