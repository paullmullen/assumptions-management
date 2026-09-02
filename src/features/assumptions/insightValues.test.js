import { describe, expect, it } from "vitest";
import { normalizeInsight } from "./insightValues.js";
describe("insight validation", () => {
  it("trims optional values and accepts all insight types", () => {
    expect(
      normalizeInsight({ description: " judgment ", sourceUrl: " " }),
    ).toEqual({ description: "judgment" });
    expect(
      normalizeInsight({
        description: "Changed project",
        sourceUrl: " https://example.com ",
        classification: "Mitigation / project change",
      }),
    ).toEqual({
      description: "Changed project",
      sourceUrl: "https://example.com",
      classification: "Mitigation / project change",
    });
  });
  it("rejects blank descriptions and unsafe or malformed URLs", () => {
    for (const values of [
      { description: " " },
      { description: "x".repeat(4001) },
      { description: "x", sourceUrl: "javascript:alert(1)" },
      { description: "x", sourceUrl: "https://" },
      { description: "x", classification: "Other" },
    ])
      expect(() => normalizeInsight(values)).toThrow();
  });
});
