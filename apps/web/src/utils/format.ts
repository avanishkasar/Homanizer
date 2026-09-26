export function truncate(s: string, max = 100): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function readingTime(text: string, wpm = 200): string {
  const mins = Math.ceil(wordCount(text) / wpm);
  return mins <= 1 ? "1 min read" : `${mins} min read`;
}
