export const API_VERSION = "v1";
export const MAX_INPUT_LENGTH = 5000;
export const MAX_HISTORY_ITEMS = 50;
export const SUPPORTED_TONES = ["formal", "casual", "neutral"] as const;
export type Tone = typeof SUPPORTED_TONES[number];
