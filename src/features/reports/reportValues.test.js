import { expect, it } from "vitest";
import { fieldText, fitProblems, sortedReportRows } from "./reportValues.js";
it("keeps numbering stable when sorting attention and keeps zero scores assessed", () => {
  const rows = [
    { id: "a", criticality: 0, evidence: 0 },
    { id: "b", criticality: 80, evidence: 10 },
    { id: "c" },
  ];
  expect(
    sortedReportRows(rows, "attention").map((r) => [r.id, r.number]),
  ).toEqual([
    ["c", 3],
    ["b", 2],
    ["a", 1],
  ]);
});
it("distinguishes missing historical values and empty saved values", () => {
  expect(fieldText({ kind: "review" }, undefined)).toBe("Not recorded");
  expect(fieldText({ kind: "review" }, "")).toBe("Not set");
});
it("blocks printing when any fixed page region overflows", () => {
  const region = {
    clientWidth: 100,
    scrollWidth: 100,
    clientHeight: 100,
    scrollHeight: 101,
    dataset: { fit: "Promise" },
  };
  const page = {
    clientWidth: 1000,
    scrollWidth: 1000,
    clientHeight: 750,
    scrollHeight: 750,
    dataset: {},
    querySelectorAll: () => [region],
  };
  expect(fitProblems(page)).toEqual([]);
  region.scrollHeight = 130;
  expect(fitProblems(page)).toEqual(["Promise"]);
  expect(fitProblems(null)).toHaveLength(1);
});
