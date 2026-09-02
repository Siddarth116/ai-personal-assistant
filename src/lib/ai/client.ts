import OpenAI from "openai";

export function isAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Points at the standard OpenAI API by default. Set OPENAI_BASE_URL to use
 * any OpenAI-compatible provider instead - e.g. Google's Gemini API, which
 * exposes an official OpenAI-compatible endpoint at:
 *   https://generativelanguage.googleapis.com/v1beta/openai/
 * In that case OPENAI_API_KEY should hold your Google AI Studio key, and
 * OPENAI_MODEL should be a Gemini model name (e.g. "gemini-2.5-flash").
 */
export function getOpenAiClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
}

export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
