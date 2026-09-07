import { DateTime } from "luxon";
import type { RECURRENCE_TYPES } from "@/lib/db/schema";

export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];

export interface Occurrence {
  start: DateTime;
  end: DateTime;
}

const MAX_ITERATIONS = 500; // safety cap - prevents runaway loops on malformed data, not a real-world limit

/**
 * Expands a (possibly recurring) event into the concrete occurrences that
 * overlap [rangeStart, rangeEnd]. For "NONE" recurrence this just checks the
 * single stored time, same as before. For DAILY/WEEKLY/MONTHLY/YEARLY, the
 * event's own startTime/endTime is the anchor - occurrences repeat forever
 * into the future from there (there's no "recurrence end date" concept in
 * this app, matching the original scope: don't implement arbitrary
 * recurrence syntax unless necessary).
 *
 * Occurrences are computed on the fly at query time rather than stored as
 * individual rows, so editing the recurrence rule on the original event
 * changes every future occurrence at once. The tradeoff (documented as a
 * known simplification) is that there's no way to edit or delete a single
 * occurrence independently of the whole series - only the anchor event
 * itself can be edited/deleted, which affects the entire series.
 */
export function expandOccurrences(
  anchorStart: DateTime,
  anchorEnd: DateTime,
  recurrence: RecurrenceType,
  rangeStart: DateTime,
  rangeEnd: DateTime
): Occurrence[] {
  if (recurrence === "NONE") {
    return overlaps(anchorStart, anchorEnd, rangeStart, rangeEnd) ? [{ start: anchorStart, end: anchorEnd }] : [];
  }

  const durationMs = anchorEnd.toMillis() - anchorStart.toMillis();
  const startIndex = estimateStartIndex(anchorStart, recurrence, rangeStart);

  const results: Occurrence[] = [];
  let n = startIndex;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    const occStart = advance(anchorStart, recurrence, n);
    if (occStart > rangeEnd) break;

    const occEnd = occStart.plus({ milliseconds: durationMs });
    if (overlaps(occStart, occEnd, rangeStart, rangeEnd)) {
      results.push({ start: occStart, end: occEnd });
    }

    n++;
    iterations++;
  }

  return results;
}

function overlaps(aStart: DateTime, aEnd: DateTime, bStart: DateTime, bEnd: DateTime): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function advance(anchor: DateTime, recurrence: RecurrenceType, n: number): DateTime {
  switch (recurrence) {
    case "DAILY":
      return anchor.plus({ days: n });
    case "WEEKLY":
      return anchor.plus({ weeks: n });
    case "MONTHLY":
      return anchor.plus({ months: n });
    case "YEARLY":
      return anchor.plus({ years: n });
    default:
      return anchor;
  }
}

/** Rough starting index so we don't iterate from occurrence 0 for events far in the past relative to the query range. */
function estimateStartIndex(anchor: DateTime, recurrence: RecurrenceType, rangeStart: DateTime): number {
  if (rangeStart <= anchor) return 0;

  let approx: number;
  switch (recurrence) {
    case "DAILY":
      approx = rangeStart.diff(anchor, "days").days;
      break;
    case "WEEKLY":
      approx = rangeStart.diff(anchor, "weeks").weeks;
      break;
    case "MONTHLY":
      approx = rangeStart.diff(anchor, "months").months;
      break;
    case "YEARLY":
      approx = rangeStart.diff(anchor, "years").years;
      break;
    default:
      approx = 0;
  }

  // Step back by 1 to be safe about boundary/rounding cases, never negative.
  return Math.max(0, Math.floor(approx) - 1);
}
