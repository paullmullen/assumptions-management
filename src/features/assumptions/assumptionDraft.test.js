import { describe, expect, it } from "vitest";
import { prepareAssumptionDraft } from "./assumptionDraft.js";

describe("assumption draft validation", () => {
  const baseline = {
    statement: "Customers will adopt it.",
    criticality: 80,
    evidence: 20,
  };

  it("allows classification without a description when the assumption changes", () => {
    const prepared = prepareAssumptionDraft(
      baseline,
      { ...baseline, evidence: 30 },
      { description: "", sourceUrl: "", classification: "Revised judgment" },
    );

    expect(prepared.changes).toEqual({ evidence: 30 });
    expect(prepared.entry).toEqual({ classification: "Revised judgment" });
  });

  it("still requires a description for classification without an assumption change", () => {
    expect(() =>
      prepareAssumptionDraft(baseline, baseline, {
        description: "",
        sourceUrl: "",
        classification: "Revised judgment",
      }),
    ).toThrow("Enter a description");
  });
});
