import { z } from "zod";

/**
 * Strips HTML tags and normalises whitespace from raw user text.
 * Used before feeding content to the rewrite engine.
 */
export function sanitizeInput(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const inputSchema = z.object({
  text: z.string().min(1).max(5000),
  tone: z.enum(["formal", "casual", "neutral"]).default("neutral"),
});
