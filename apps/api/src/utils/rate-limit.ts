const windowMs = 60_000;
const maxRequests = 30;

interface Entry { count: number; resetAt: number }
const store = new Map<string, Entry>();

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > maxRequests;
}
