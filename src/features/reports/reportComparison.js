import { assessed, promiseLabels } from "./reportValues.js";

export function comparisonBaseline(source, reviews) {
  const eligible = reviews.filter(
    (review) =>
      source.kind === "current" ||
      (review.publishedAt.toMillis() < source.publishedAt &&
        review.capturedAt < source.capturedAt),
  );
  return (
    eligible.sort(
      (a, b) =>
        b.publishedAt.toMillis() - a.publishedAt.toMillis() ||
        b.id.localeCompare(a.id),
    )[0] ?? null
  );
}

export function compareReport(source, baseline) {
  if (!baseline) return null;
  const before = new Map(baseline.assumptions.map((row) => [row.id, row]));
  const rows = source.assumptions.map((row) => {
    const old = before.get(row.id);
    const known = new Set((old?.insights ?? []).map((item) => item.id));
    const insightsKnown =
      Array.isArray(row.insights) && (!old || Array.isArray(old.insights));
    return {
      id: row.id,
      added: !old,
      previous: old,
      scoresChanged:
        Boolean(old) &&
        (assessed(old) !== assessed(row) ||
          (assessed(row) &&
            (old.criticality !== row.criticality ||
              old.evidence !== row.evidence))),
      wordingChanged: Boolean(old) && old.statement !== row.statement,
      newInsights: insightsKnown
        ? row.insights.filter(
            (item) => item.description?.trim() && !known.has(item.id),
          ).length
        : null,
    };
  });
  return {
    capturedAt: baseline.capturedAt,
    rows,
    added: rows.filter((row) => row.added).length,
    scoresChanged: rows.filter((row) => row.scoresChanged).length,
    wordingChanged: rows.filter((row) => row.wordingChanged).length,
    newInsights: rows.some((row) => row.newInsights == null)
      ? null
      : rows.reduce((sum, row) => sum + row.newInsights, 0),
    missing: baseline.assumptions.filter(
      (row) => !source.assumptions.some((item) => item.id === row.id),
    ).length,
    promisesChanged: Object.keys(promiseLabels)
      .filter(
        (key) =>
          (source.promises?.[key] ?? "") !== (baseline.promises?.[key] ?? ""),
      )
      .map((key) => promiseLabels[key]),
  };
}

export function scoreComparison(row, change) {
  if (!change?.scoresChanged)
    return assessed(row)
      ? `Consequence ${row.criticality} | Evidence ${row.evidence}`
      : "Not assessed";
  const old = change.previous;
  if (!assessed(old) || !assessed(row)) {
    const pair = (value) =>
      assessed(value)
        ? `Consequence ${value.criticality} / Evidence ${value.evidence}`
        : "Not assessed";
    return `${pair(old)} → ${pair(row)}`;
  }
  return `Consequence ${old.criticality} → ${row.criticality} | Evidence ${old.evidence} → ${row.evidence}`;
}
