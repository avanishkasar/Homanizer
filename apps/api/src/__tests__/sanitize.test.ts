import { describe, it, expect } from "vitest";
import { sanitizeInput } from "../utils/sanitize";

describe("sanitizeInput", () => {
  it("strips HTML tags", () => {
    expect(sanitizeInput("<b>hello</b>")).toBe("hello");
  });

  it("normalises whitespace", () => {
    expect(sanitizeInput("  hello   world  ")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(sanitizeInput("")).toBe("");
  });

  it("preserves plain text", () => {
    expect(sanitizeInput("no tags here")).toBe("no tags here");
  });
});
