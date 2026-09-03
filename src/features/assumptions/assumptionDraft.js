import { normalizeInsight } from "./insightValues.js";
export const assumptionFields = {
  statement: "Assumption",
  criticality: "Criticality if wrong",
  evidence: "Strength of supporting evidence",
  nextStep: "Next step",
  helpNeeded: "Help needed",
};
export function editableAssumption(value = {}) {
  return {
    statement: value.statement ?? "",
    criticality: value.criticality ?? null,
    evidence: value.evidence ?? null,
    nextStep: value.nextStep ?? "",
    helpNeeded: value.helpNeeded ?? "",
  };
}
export function prepareAssumptionDraft(baseline, draft, insight) {
  const saved = editableAssumption(baseline ?? {});
  const values = editableAssumption(draft);
  for (const key of ["statement", "nextStep", "helpNeeded"]) {
    if (typeof values[key] !== "string")
      throw new Error("Enter text for the assumption and next steps.");
    values[key] = values[key].trim();
    if (values[key].length > (key === "statement" ? 2000 : 4000))
      throw new Error(`${assumptionFields[key]} is too long.`);
  }
  if (!values.statement)
    throw new Error("Enter an affirmative assumption statement.");
  const changes = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => value !== saved[key]),
  );
  const scoresChanged = "criticality" in changes || "evidence" in changes;
  if (
    scoresChanged &&
    ![values.criticality, values.evidence].every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 100,
    )
  )
    throw new Error(
      "Enter both scores as whole numbers from 0–100, or restore the saved scores.",
    );
  const entry =
    insight &&
    (insight.description?.trim() ||
      insight.sourceUrl?.trim() ||
      insight.classification)
      ? normalizeInsight(insight)
      : null;
  return { saved, values, changes, scoresChanged, entry };
}
