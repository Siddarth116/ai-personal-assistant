import { describe, it, expect } from "vitest";
import { detectUrgencyCues, formatUrgencyHint } from "@/lib/ai/urgency";

describe("detectUrgencyCues", () => {
  it("returns no suggestion for neutral text", () => {
    const hint = detectUrgencyCues("Schedule a meeting with John tomorrow at 3pm");
    expect(hint.suggestedPriority).toBeNull();
    expect(hint.matchedPhrases).toEqual([]);
  });

  it("detects URGENT-level cues", () => {
    const hint = detectUrgencyCues("I need this done ASAP, it's urgent");
    expect(hint.suggestedPriority).toBe("URGENT");
    expect(hint.matchedPhrases).toContain("asap");
  });

  it("detects HIGH-level cues", () => {
    const hint = detectUrgencyCues("This is important, there's a deadline coming up");
    expect(hint.suggestedPriority).toBe("HIGH");
  });

  it("detects LOW-level cues", () => {
    const hint = detectUrgencyCues("No rush on this one, whenever you get a chance");
    expect(hint.suggestedPriority).toBe("LOW");
  });

  it("flags mixed signals when multiple severity groups match", () => {
    const hint = detectUrgencyCues("This is urgent but honestly there's no rush");
    expect(hint.mixedSignals).toBe(true);
  });

  it("is case-insensitive", () => {
    const hint = detectUrgencyCues("URGENT!! Need this ASAP");
    expect(hint.suggestedPriority).toBe("URGENT");
  });
});

describe("formatUrgencyHint", () => {
  it("returns an empty string when there is no suggestion", () => {
    expect(formatUrgencyHint({ suggestedPriority: null, matchedPhrases: [], mixedSignals: false })).toBe("");
  });

  it("includes the matched phrases and severity in the hint text", () => {
    const text = formatUrgencyHint({ suggestedPriority: "URGENT", matchedPhrases: ["asap"], mixedSignals: false });
    expect(text).toContain("URGENT");
    expect(text).toContain("asap");
  });

  it("uses different wording for mixed signals", () => {
    const text = formatUrgencyHint({
      suggestedPriority: "URGENT",
      matchedPhrases: ["urgent", "no rush"],
      mixedSignals: true,
    });
    expect(text).toContain("mixed urgency language");
  });
});
