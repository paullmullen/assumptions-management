const assessed = (row) =>
  [row?.criticality, row?.evidence].every(
    (value) => Number.isInteger(value) && value >= 0 && value <= 100,
  );
export function reviewMovement(assumptions, review) {
  if (!review) return [];
  return assumptions.map((row, index) => {
    const prior = review.assumptions.find((item) => item.id === row.id);
    const changed =
      assessed(row) &&
      assessed(prior) &&
      (row.criticality !== prior.criticality ||
        row.evidence !== prior.evidence);
    const scores = (value) =>
      assessed(value)
        ? `consequence ${value.criticality}, evidence ${value.evidence}`
        : "not assessed";
    return {
      id: row.id,
      number: index + 1,
      from: prior,
      to: row,
      changed,
      wordingChanged: Boolean(prior) && prior.statement !== row.statement,
      description: !prior
        ? "New since review; no prior position."
        : `${scores(prior)} → ${scores(row)}${changed ? "" : " (no plotted movement)"}.${prior.statement !== row.statement ? " Wording changed; compare scores with care." : ""}`,
    };
  });
}
