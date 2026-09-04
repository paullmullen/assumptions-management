export const promiseLabels = {
  customerPromise: "Customer",
  investorPromise: "Investor",
  coworkerPromise: "Coworkers",
};
export const rowLabels = {
  statement: "Assumption",
  nextStep: "Next step",
  helpNeeded: "Help needed",
};
export const assessed = (row) =>
  [row.criticality, row.evidence].every(
    (value) => Number.isInteger(value) && value >= 0 && value <= 100,
  );
export function fieldText(source, value) {
  return value == null
    ? source.kind === "review"
      ? "Not recorded"
      : "Not set"
    : value || "Not set";
}
export function reportText(source, overrides, key, value) {
  return overrides[key] ?? fieldText(source, value);
}
export function fitProblems(element) {
  if (!element || element.clientWidth === 0) return ["Preview is not ready."];
  const areas = [element, ...element.querySelectorAll("[data-fit]")];
  return areas
    .filter(
      (area) =>
        area.scrollHeight > area.clientHeight + 1 ||
        area.scrollWidth > area.clientWidth + 1,
    )
    .map((area) => area.dataset.fit || "Page");
}
export function sortedReportRows(rows, order) {
  const numbered = rows.map((row, index) => ({ ...row, number: index + 1 }));
  return order === "attention"
    ? numbered.sort(
        (a, b) =>
          Number(assessed(a)) - Number(assessed(b)) ||
          (b.criticality ?? 0) -
            (b.evidence ?? 0) -
            ((a.criticality ?? 0) - (a.evidence ?? 0)) ||
          a.number - b.number,
      )
    : numbered;
}

export function reportFitMessage(problems, selectedCount) {
  const areas = [...new Set(problems)];
  const advice = [];
  if (areas.includes("Assumption legend"))
    advice.push(
      "Shorten assumption names using report-only excerpts; every assumption remains in the legend.",
    );
  if (areas.includes("Selected assumptions"))
    advice.push(
      selectedCount
        ? "Shorten selected details or select fewer discussion items."
        : "The empty discussion area does not fit; this is a layout issue.",
    );
  if (areas.includes("Portfolio chart"))
    advice.push(
      "The chart area does not fit. Changing discussion selections will not reduce the chart; report this layout issue.",
    );
  if (areas.includes("Project name"))
    advice.push(
      "Open “Shorten text for this report” and shorten “Project name” to fit two lines. This changes only the report.",
    );
  if (areas.includes("Report source and review title"))
    advice.push(
      "Open “Shorten text for this report” and shorten “Review title”. If the source dates alone overflow, this is a layout issue.",
    );
  if (areas.some((area) => area.endsWith(" promise")))
    advice.push("Shorten the indicated text using report-only excerpts.");
  if (!advice.length)
    advice.push(
      "Check the indicated area in the preview; report-only excerpts can shorten long text.",
    );
  return `Does not fit: ${areas.join(", ")}. ${advice.join(" ")} Long promises use ellipses; other overflowing text must be adjusted.`;
}
