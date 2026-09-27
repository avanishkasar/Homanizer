type Level = "info" | "warn" | "error" | "debug";

export function log(level: Level, message: string, meta?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  console[level === "error" ? "error" : "log"](JSON.stringify(entry));
}
