export function safeResponse(data: unknown): string {
  if (!data || typeof data !== "string") return "";
  return data.trim();
}
