import { describe, expect, it } from "vitest";
import type { WritingStyle } from "./index";

describe("shared types", () => {
  it("supports the published writing styles", () => {
    const style: WritingStyle = "clear";
    expect(style).toBe("clear");
  });
});
