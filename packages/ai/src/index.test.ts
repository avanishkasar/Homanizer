import { describe, expect, it } from "vitest";
import { OpenAIRewriteProvider } from "./index";

describe("OpenAIRewriteProvider validation", () => {
  it("flags a changed number", () => {
    const provider = new OpenAIRewriteProvider("test", "test");
    expect(provider.validate("Ada saved 42 files.", "Ada saved files.").riskScore).toBeGreaterThan(0);
  });

  it("accepts protected values that remain", () => {
    const provider = new OpenAIRewriteProvider("test", "test");
    expect(provider.validate("Ada saved 42 files.", "Ada efficiently saved 42 files.").isSafe).toBe(true);
  });
});
