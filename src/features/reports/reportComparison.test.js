import { expect, it } from "vitest";
import {
  compareReport,
  comparisonBaseline,
  scoreComparison,
} from "./reportComparison.js";
const row = {
  id: "a",
  statement: "Old",
  criticality: 80,
  evidence: 20,
  insights: [{ id: "i", description: "Prior insight" }],
};
const baseline = {
  id: "r",
  capturedAt: 100,
  publishedAt: { toMillis: () => 200 },
  assumptions: [row],
  promises: { customerPromise: "Before" },
};
it("matches renamed assumptions by ID, counts descriptions only, and reports net scores", () => {
  const current = {
    ...row,
    statement: "New",
    evidence: 60,
    insights: [
      ...row.insights,
      { id: "score", description: "" },
      { id: "wording" },
      { id: "new", description: "Learning" },
    ],
  };
  const result = compareReport(
    {
      assumptions: [current, { id: "b", insights: [] }],
      promises: { customerPromise: "After" },
    },
    baseline,
  );
  expect(result).toMatchObject({
    added: 1,
    scoresChanged: 1,
    newInsights: 1,
    wordingChanged: 1,
    promisesChanged: ["Customer"],
  });
  expect(scoreComparison(current, result.rows[0])).toBe(
    "Consequence 80 → 80 | Evidence 20 → 60",
  );
  expect(result.rows[1].previous).toBeUndefined();
});
it("handles unassessed transitions and zero without inventing scores", () => {
  const current = { ...row, criticality: 0, evidence: 0 };
  const result = compareReport(
    { assumptions: [current] },
    {
      ...baseline,
      assumptions: [{ ...row, criticality: null, evidence: null }],
    },
  );
  expect(scoreComparison(current, result.rows[0])).toBe(
    "Not assessed → Consequence 0 / Evidence 0",
  );
});
it("uses only earlier captures for historical reports, even if an older draft was saved later", () => {
  const lateDraft = {
    ...baseline,
    id: "late",
    capturedAt: 50,
    publishedAt: { toMillis: () => 400 },
  };
  const futureCapture = {
    ...baseline,
    id: "future",
    capturedAt: 500,
    publishedAt: { toMillis: () => 250 },
  };
  expect(
    comparisonBaseline({ kind: "review", publishedAt: 300, capturedAt: 300 }, [
      lateDraft,
      futureCapture,
      baseline,
    ]),
  ).toBe(baseline);
  expect(comparisonBaseline({ kind: "current" }, [baseline, lateDraft])).toBe(
    lateDraft,
  );
  expect(
    comparisonBaseline({ kind: "review", publishedAt: 200, capturedAt: 100 }, [
      baseline,
    ]),
  ).toBeNull();
});
it("does not claim zero insights when historical insight data is missing", () => {
  expect(
    compareReport({ assumptions: [{ ...row, insights: undefined }] }, baseline)
      .newInsights,
  ).toBeNull();
  expect(compareReport({ assumptions: [] }, null)).toBeNull();
});
