export const portfolioSortOptions = [
  ["number", "Assumption number"],
  ["attention", "Attention priority"],
  ["criticality", "Consequence — highest first"],
  ["evidence", "Evidence — weakest first"],
  ["recent", "Recent change — newest first"],
];
export function activityTime(assumption, insights = []) {
  return Math.max(
    0,
    assumption.createdAt?.toMillis?.() ?? 0,
    assumption.updatedAt?.toMillis?.() ?? 0,
    ...insights.map((entry) => entry.createdAt?.toMillis?.() ?? 0),
  );
}
export function sortPortfolio(assumptions, order, activity = {}) {
  const rows = assumptions.map((assumption, index) => ({
    assumption,
    number: index + 1,
  }));
  const assessed = (item) =>
    Number.isInteger(item.criticality) && Number.isInteger(item.evidence);
  return rows.sort((a, b) => {
    const left = a.assumption;
    const right = b.assumption;
    let difference = 0;
    if (order === "recent")
      difference = (activity[right.id] ?? 0) - (activity[left.id] ?? 0);
    else if (order !== "number") {
      // Missing scores are a separate assessment task, never an invented zero.
      difference = Number(assessed(left)) - Number(assessed(right));
      if (!difference && assessed(left) && assessed(right)) {
        if (order === "attention")
          difference =
            right.criticality -
            right.evidence -
            (left.criticality - left.evidence);
        if (order === "criticality")
          difference = right.criticality - left.criticality;
        if (order === "evidence") difference = left.evidence - right.evidence;
      }
    }
    return difference || a.number - b.number;
  });
}
