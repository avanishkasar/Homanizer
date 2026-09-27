import { describe, it, expect, vi } from "vitest";

// Mock chrome.storage
const mockStorage: Record<string, unknown> = {};
global.chrome = {
  storage: {
    sync: {
      get: vi.fn(async () => mockStorage),
      set: vi.fn(async (data) => Object.assign(mockStorage, data)),
    },
  },
} as unknown as typeof chrome;

describe("extension storage", () => {
  it("returns defaults when empty", async () => {
    const { getSettings } = await import("../utils/storage");
    const settings = await getSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.tone).toBe("neutral");
  });
});
