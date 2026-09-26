import { describe, it, expect } from "vitest";
import { estimateTokens, truncateToTokenLimit } from "../utils/tokens";

describe("estimateTokens", () => {
  it("estimates short text", () => {
    expect(estimateTokens("hello")).toBe(2);
  });

  it("estimates longer text", () => {
    const text = "a".repeat(400);
    expect(estimateTokens(text)).toBe(100);
  });
});

describe("truncateToTokenLimit", () => {
  it("does not truncate short text", () => {
    expect(truncateToTokenLimit("hi", 100)).toBe("hi");
  });

  it("truncates and adds ellipsis", () => {
    const result = truncateToTokenLimit("a".repeat(500), 10);
    expect(result.endsWith("...")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(43);
  });
});
