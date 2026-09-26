export function buildPrompt(text: string, tone: string): string {
  const instructions: Record<string, string> = {
    formal: "Rewrite in a professional, formal tone. Avoid contractions.",
    casual: "Rewrite in a friendly, conversational tone. Keep it natural.",
    neutral: "Rewrite for clarity. Fix grammar and improve readability.",
  };

  return `${instructions[tone] || instructions.neutral}\n\nOriginal:\n${text}\n\nRewritten:`;
}
