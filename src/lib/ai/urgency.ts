/**
 * A deliberately simple, deterministic keyword scan for urgency/priority
 * language in a user's message - NOT a full sentiment model. It exists to
 * give the LLM a concrete, testable hint rather than relying purely on the
 * model's own judgment, and to make the assistant's behavior here debuggable
 * (you can see exactly which phrase triggered a given suggestion).
 *
 * The LLM still makes the final call on what to ask and how to phrase it -
 * this just surfaces evidence for it to reason over.
 */

export type UrgencyLevel = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface CueGroup {
  level: UrgencyLevel;
  phrases: string[];
}

// Ordered from most to least severe - the first group with a match wins,
// so "urgent, but honestly no rush" still flags URGENT for the human to
// disambiguate rather than silently picking one side.
const CUE_GROUPS: CueGroup[] = [
  {
    level: "URGENT",
    phrases: ["asap", "urgent", "urgently", "immediately", "right away", "critical", "emergency", "can't wait"],
  },
  {
    level: "HIGH",
    phrases: ["important", "priority", "deadline", "due soon", "before end of day", "eod", "high priority", "must do"],
  },
  {
    level: "LOW",
    phrases: ["whenever", "no rush", "no hurry", "sometime", "eventually", "low priority", "not urgent", "when i get a chance"],
  },
];

export interface UrgencyHint {
  /** The highest-severity cue level found, or null if nothing matched. */
  suggestedPriority: UrgencyLevel | null;
  /** The exact phrases that matched, for transparency/debugging. */
  matchedPhrases: string[];
  /** True if cues from more than one severity group were found (mixed signal - worth asking about explicitly). */
  mixedSignals: boolean;
}

export function detectUrgencyCues(text: string): UrgencyHint {
  const t = text.toLowerCase();
  const matchedGroups: { level: UrgencyLevel; phrases: string[] }[] = [];

  for (const group of CUE_GROUPS) {
    const matches = group.phrases.filter((p) => t.includes(p));
    if (matches.length > 0) {
      matchedGroups.push({ level: group.level, phrases: matches });
    }
  }

  if (matchedGroups.length === 0) {
    return { suggestedPriority: null, matchedPhrases: [], mixedSignals: false };
  }

  return {
    suggestedPriority: matchedGroups[0].level,
    matchedPhrases: matchedGroups.flatMap((g) => g.phrases),
    mixedSignals: matchedGroups.length > 1,
  };
}

/** Renders a hint as a short note to append to the system prompt for this turn. Returns "" if there's nothing to flag. */
export function formatUrgencyHint(hint: UrgencyHint): string {
  if (!hint.suggestedPriority) return "";

  const phraseList = hint.matchedPhrases.map((p) => `"${p}"`).join(", ");

  if (hint.mixedSignals) {
    return `\n\nNOTE: The user's latest message contains mixed urgency language (${phraseList}), suggesting different priority levels. If they're creating or updating a task, event, or reminder without an explicit priority, ask them directly which priority/timing they actually want instead of guessing.`;
  }

  return `\n\nNOTE: The user's latest message contains language suggesting ${hint.suggestedPriority} priority (${phraseList}). If they're creating or updating a task, event, or reminder and haven't explicitly stated a priority level or exact timing, consider asking them to confirm the priority and/or timing rather than assuming - especially if the wording is casual or ambiguous about how firm the deadline is.`;
}
