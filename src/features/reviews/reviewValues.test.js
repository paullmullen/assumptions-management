import { describe, expect, it } from "vitest";
import { compareReview, validateReview } from "./reviewValues.js";
const row = {
  id: "a",
  statement: "Promise holds",
  criticality: 90,
  evidence: null,
  nextStep: "",
  helpNeeded: "",
  insights: [],
};
describe("review comparison", () => {
  it("distinguishes the initial baseline from subsequent new assumptions", () => {
    expect(compareReview({ assumptions: [row] }, null)[0].status).toBe(
      "Baseline",
    );
    expect(
      compareReview({ assumptions: [row] }, { assumptions: [] })[0].status,
    ).toBe("New");
  });
  it("finds insight-only additions by identity without relying on clock timestamps", () => {
    const old = { ...row, insights: [{ id: "old", createdAt: 100 }] };
    const current = {
      ...old,
      insights: [...old.insights, { id: "new", createdAt: 1 }],
    };
    const result = compareReview(
      { assumptions: [current] },
      { assumptions: [old] },
    )[0];
    expect(result.changes).toEqual([]);
    expect(result.newInsights.map((item) => item.id)).toEqual(["new"]);
  });
  it("retains zero scores, unassessed values, cleared next steps, and removed assumptions", () => {
    const previous = {
      assumptions: [
        { ...row, nextStep: "Test" },
        { ...row, id: "removed" },
      ],
    };
    const result = compareReview(
      { assumptions: [{ ...row, evidence: 0 }] },
      previous,
    );
    expect(result[0].changes).toEqual([
      { key: "evidence", from: null, to: 0 },
      { key: "nextStep", from: "Test", to: "" },
    ]);
    expect(result[1].status).toBe("No longer present");
    expect(previous.assumptions[0].nextStep).toBe("Test");
  });
  it("rejects empty titles and oversize payloads before writing", () => {
    expect(() => validateReview({ title: " ", notes: "" })).toThrow("title");
    expect(() =>
      validateReview({
        title: "Review",
        notes: "",
        assumptions: ["x".repeat(800000)],
      }),
    ).toThrow("too large");
  });
});
