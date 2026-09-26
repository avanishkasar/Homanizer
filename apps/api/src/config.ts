export const config = {
  maxInputLength: parseInt(process.env.MAX_INPUT_LENGTH || "5000", 10),
  rateLimitWindow: 60_000,
  rateLimitMax: 30,
  cacheMaxEntries: 500,
  cacheTtlMs: 3_600_000,
  defaultTone: "neutral" as const,
} as const;

export type Config = typeof config;
