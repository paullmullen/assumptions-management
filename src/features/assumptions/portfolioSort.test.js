import { expect, it } from "vitest";
import { activityTime, sortPortfolio } from "./portfolioSort.js";
const assumptions = [
  { id: "a", criticality: 80, evidence: 70 },
  { id: "b", criticality: 60, evidence: 20 },
  { id: "c" },
  { id: "d", criticality: 80, evidence: 40 },
  { id: "e", criticality: 0, evidence: 0 },
];
const ids = (order, dates) =>
  sortPortfolio(assumptions, order, dates).map(
    ({ assumption }) => assumption.id,
  );
it("matches diagonal priority, separates missing assessments and keeps tied reference numbers", () => {
  expect(ids("attention")).toEqual(["c", "b", "d", "a", "e"]);
  expect(ids("criticality")).toEqual(["c", "a", "d", "b", "e"]);
  expect(ids("evidence")).toEqual(["c", "e", "b", "d", "a"]);
  expect(sortPortfolio(assumptions, "attention")[1].number).toBe(2);
  expect(ids("number")).toEqual(["a", "b", "c", "d", "e"]);
});
it("uses latest recorded content or insight activity, with unknown dates last", () => {
  const stamp = (value) => ({ toMillis: () => value });
  expect(
    activityTime({ createdAt: stamp(1), updatedAt: stamp(5) }, [
      { createdAt: stamp(8) },
    ]),
  ).toBe(8);
  expect(
    activityTime({ updatedAt: stamp(10) }, [{ createdAt: stamp(8) }]),
  ).toBe(10);
  expect(activityTime({})).toBe(0);
  expect(ids("recent", { a: 5, b: 8, d: 10 })).toEqual([
    "d",
    "b",
    "a",
    "c",
    "e",
  ]);
});
