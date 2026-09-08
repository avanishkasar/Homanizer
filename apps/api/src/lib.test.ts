import { describe, expect, it } from "vitest";
import { classify } from "./lib";
describe("classifier", () => {
  it.each([["https://example.com", "url"], ["const x = 1;", "code"], ["# Heading", "markdown"], ["This is ordinary prose.", "prose"]] as const)("classifies %s", (input, kind) => expect(classify(input)).toBe(kind));
});
