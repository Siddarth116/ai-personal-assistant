import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import { expandOccurrences } from "@/lib/utils/recurrence";

const iso = (s: string) => DateTime.fromISO(s, { zone: "utc" });

describe("expandOccurrences", () => {
  it("returns the single occurrence for NONE when it overlaps the range", () => {
    const result = expandOccurrences(
      iso("2026-01-06T09:00:00Z"),
      iso("2026-01-06T10:00:00Z"),
      "NONE",
      iso("2026-01-06T00:00:00Z"),
      iso("2026-01-06T23:59:59Z")
    );
    expect(result).toHaveLength(1);
  });

  it("returns nothing for NONE outside the range", () => {
    const result = expandOccurrences(
      iso("2026-01-06T09:00:00Z"),
      iso("2026-01-06T10:00:00Z"),
      "NONE",
      iso("2026-02-01T00:00:00Z"),
      iso("2026-02-02T00:00:00Z")
    );
    expect(result).toHaveLength(0);
  });

  it("expands a WEEKLY class across several future weeks - the exact reported bug", () => {
    // A Monday 8am class starting 2026-09-07 (a real Monday)
    const anchorStart = iso("2026-09-07T08:00:00Z");
    const anchorEnd = iso("2026-09-07T09:00:00Z");

    // Two weeks later (2026-09-21) should still show the class.
    const result = expandOccurrences(
      anchorStart,
      anchorEnd,
      "WEEKLY",
      iso("2026-09-21T00:00:00Z"),
      iso("2026-09-21T23:59:59Z")
    );
    expect(result).toHaveLength(1);
    expect(result[0].start.toISO()).toBe(iso("2026-09-21T08:00:00Z").toISO());
  });

  it("expands a WEEKLY event many months into the future", () => {
    const anchorStart = iso("2026-01-05T08:00:00Z"); // a Monday
    const anchorEnd = iso("2026-01-05T09:00:00Z");

    const result = expandOccurrences(
      anchorStart,
      anchorEnd,
      "WEEKLY",
      iso("2026-06-01T00:00:00Z"),
      iso("2026-06-07T23:59:59Z")
    );
    // Exactly one Monday should fall in that first-week-of-June window.
    expect(result).toHaveLength(1);
    expect(result[0].start.weekday).toBe(1); // Monday
  });

  it("produces no occurrences before the anchor start", () => {
    const result = expandOccurrences(
      iso("2026-09-07T08:00:00Z"),
      iso("2026-09-07T09:00:00Z"),
      "WEEKLY",
      iso("2026-08-01T00:00:00Z"),
      iso("2026-08-31T23:59:59Z")
    );
    expect(result).toHaveLength(0);
  });

  it("expands DAILY recurrence correctly", () => {
    const result = expandOccurrences(
      iso("2026-01-01T07:00:00Z"),
      iso("2026-01-01T07:15:00Z"),
      "DAILY",
      iso("2026-01-10T00:00:00Z"),
      iso("2026-01-12T23:59:59Z")
    );
    expect(result).toHaveLength(3); // Jan 10, 11, 12
  });

  it("expands MONTHLY recurrence correctly", () => {
    const result = expandOccurrences(
      iso("2026-01-15T10:00:00Z"),
      iso("2026-01-15T10:30:00Z"),
      "MONTHLY",
      iso("2026-04-01T00:00:00Z"),
      iso("2026-04-30T23:59:59Z")
    );
    expect(result).toHaveLength(1);
    expect(result[0].start.day).toBe(15);
  });

  it("expands YEARLY recurrence correctly", () => {
    const result = expandOccurrences(
      iso("2024-03-10T10:00:00Z"),
      iso("2024-03-10T11:00:00Z"),
      "YEARLY",
      iso("2027-03-01T00:00:00Z"),
      iso("2027-03-31T23:59:59Z")
    );
    expect(result).toHaveLength(1);
    expect(result[0].start.year).toBe(2027);
  });

  it("finds multiple occurrences when the range spans several intervals", () => {
    const result = expandOccurrences(
      iso("2026-09-07T08:00:00Z"), // Monday
      iso("2026-09-07T09:00:00Z"),
      "WEEKLY",
      iso("2026-09-01T00:00:00Z"),
      iso("2026-09-30T23:59:59Z")
    );
    // Mondays in Sept 2026 on/after the 7th: 7, 14, 21, 28
    expect(result).toHaveLength(4);
  });

  it("never runs away for a distant future range (safety cap doesn't get hit for realistic ranges)", () => {
    const result = expandOccurrences(
      iso("2020-01-01T08:00:00Z"),
      iso("2020-01-01T09:00:00Z"),
      "DAILY",
      iso("2030-01-01T00:00:00Z"),
      iso("2030-01-02T23:59:59Z")
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(2);
  });
});
