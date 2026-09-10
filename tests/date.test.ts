import { describe, it, expect } from "vitest";
import { toUtcIso } from "@/lib/utils/date";

describe("toUtcIso - timezone fallback robustness", () => {
  it("respects an explicit +05:30 offset regardless of fallback zone", () => {
    expect(toUtcIso("2026-09-10T18:00:00+05:30", "Asia/Kolkata")).toBe("2026-09-10T12:30:00.000Z");
    expect(toUtcIso("2026-09-10T18:00:00+05:30", "America/New_York")).toBe("2026-09-10T12:30:00.000Z");
  });

  it("respects an explicit UTC (Z) offset regardless of fallback zone", () => {
    expect(toUtcIso("2026-09-10T18:00:00Z", "Asia/Kolkata")).toBe("2026-09-10T18:00:00.000Z");
  });

  it("interprets an offset-less string in the fallback zone, not the server's own timezone - this is the actual fix", () => {
    // 18:00 with no offset, told to fall back to IST, should be 12:30 UTC (18:00 - 5:30).
    // Before the fix, this would have used the server's system zone (UTC on
    // Vercel) instead, producing 18:00:00.000Z - a silent 5.5 hour shift.
    expect(toUtcIso("2026-09-10T18:00:00", "Asia/Kolkata")).toBe("2026-09-10T12:30:00.000Z");
  });

  it("defaults to Asia/Kolkata when no fallback zone is given at all", () => {
    expect(toUtcIso("2026-09-10T18:00:00")).toBe("2026-09-10T12:30:00.000Z");
  });

  it("still throws on genuinely invalid input", () => {
    expect(() => toUtcIso("not a real date")).toThrow(/Invalid date\/time/);
  });
});
