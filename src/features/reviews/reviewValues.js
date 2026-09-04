export const reviewFields = {
  statement: "Assumption",
  criticality: "Criticality",
  evidence: "Evidence",
  nextStep: "Next step",
  helpNeeded: "Help needed",
};

export function compareReview(current, previous) {
  const before = new Map(
    (previous?.assumptions ?? []).map((row) => [row.id, row]),
  );
  const rows = current.assumptions.map((row) => {
    const old = before.get(row.id);
    before.delete(row.id);
    const oldInsights = new Set((old?.insights ?? []).map((item) => item.id));
    return {
      ...row,
      status: !previous ? "Baseline" : !old ? "New" : "Existing",
      changes: old
        ? Object.keys(reviewFields)
            .filter((key) => row[key] !== old[key])
            .map((key) => ({ key, from: old[key], to: row[key] }))
        : [],
      newInsights: row.insights.filter((item) => !oldInsights.has(item.id)),
    };
  });
  for (const row of before.values()) {
    rows.push({
      ...row,
      status: "No longer present",
      changes: [],
      newInsights: [],
    });
  }
  return rows;
}

export function validateReview(review) {
  if (!review.title.trim() || review.title.trim().length > 120)
    throw new Error("Enter a review title of up to 120 characters.");
  if (review.notes.length > 4000)
    throw new Error("Review notes must be at most 4,000 characters.");
  // Leave room for Firestore field overhead below its 1 MiB document limit.
  if (new TextEncoder().encode(JSON.stringify(review)).length > 800000)
    throw new Error(
      "This review is too large to save. Your working assumptions are unchanged.",
    );
}
