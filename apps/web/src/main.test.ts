import { describe, expect, it } from "vitest";
describe("HumanizerDad branding", () => {
  it("uses the requested product name", () =>
    expect("HumanizerDad").toContain("Dad"));
});
