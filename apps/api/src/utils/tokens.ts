/**
 * Approximate GPT-style token count.
 * Rule of thumb: 1 token ≈ 4 chars in English text.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateToTokenLimit(text: string, limit: number): string {
  const charLimit = limit * 4;
  return text.length > charLimit ? text.slice(0, charLimit) + "..." : text;
}
