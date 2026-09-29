const seen = new Set<string>();

export function isDuplicate(hash: string): boolean {
  if (seen.has(hash)) return true;
  seen.add(hash);
  if (seen.size > 1000) {
    const first = seen.values().next().value;
    if (first) seen.delete(first);
  }
  return false;
}
