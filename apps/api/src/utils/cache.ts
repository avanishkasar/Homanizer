const MAX_ENTRIES = 500;
const cache = new Map<string, { result: string; ts: number }>();

export function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > 3_600_000) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

export function setCached(key: string, result: string): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { result, ts: Date.now() });
}
