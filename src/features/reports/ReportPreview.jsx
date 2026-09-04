import { reviewMovement } from "../portfolioChart/reviewMovement.js";
import { scoreComparison } from "./reportComparison.js";
import PortfolioChart from "../portfolioChart/PortfolioChart.jsx";
import { assessed, promiseLabels, reportText } from "./reportValues.js";
const date = (value) =>
  value ? new Date(value).toLocaleString() : "Not recorded";
export default function ReportPreview({
  source,
  selected,
  overrides,
  movementReview = null,
}) {
  const rows = selected
    .map((id) => source.assumptions.find((row) => row.id === id))
    .filter(Boolean);
  return (
    <article
      className="report-sheet"
      data-fit="Page"
      aria-label="One-page project brief"
    >
      <header className="report-heading">
        <p className="report-eyebrow">PROJECT BRIEF</p>
        <h1 data-fit="Project name">
          {reportText(source, overrides, "projectName", source.projectName)}
          {overrides.projectName != null && <small> (excerpt)</small>}
        </h1>
        <p className="report-source" data-fit="Report source and review title">
          {source.kind === "review"
            ? `Saved review: ${reportText(source, overrides, "reviewTitle", source.title)}${overrides.reviewTitle != null ? " (excerpt)" : ""} | Captured: ${date(source.capturedAt)} | Saved: ${date(source.publishedAt)} | Current project name shown`
            : `Current saved state | Loaded: ${date(source.loadedAt)}`}
        </p>
      </header>
      <section className="report-promises">
        {Object.entries(promiseLabels).map(([key, label]) => (
          <div key={key} data-fit={`${label} promise`}>
            <h2>
              {label}
              {overrides[key] != null && <small> (excerpt)</small>}
            </h2>
            <p
              className="report-promise-text"
              title={reportText(source, overrides, key, source.promises?.[key])}
            >
              {reportText(source, overrides, key, source.promises?.[key])}
            </p>
          </div>
        ))}
      </section>
      <div className="report-main">
        <div className="report-portfolio">
          <section className="report-chart" data-fit="Portfolio chart">
            <h2>Portfolio</h2>
            {movementReview && (
              <p className="report-movement-caption">
                Since review {date(movementReview.capturedAt)} · Outline:
                previous position; arrow: net movement.
              </p>
            )}
            <PortfolioChart
              assumptions={source.assumptions}
              readOnly
              emphasizedIds={selected}
              movement={reviewMovement(source.assumptions, movementReview)}
            />
          </section>
          <section
            className="report-legend"
            data-fit="Assumption legend"
            aria-label="Assumption legend"
          >
            <ol>
              {source.assumptions.map((row) => (
                <li
                  key={row.id}
                  className={
                    selected.includes(row.id)
                      ? "report-legend-selected"
                      : undefined
                  }
                >
                  {selected.includes(row.id) && (
                    <span aria-label="Selected for discussion">★ </span>
                  )}
                  {reportText(
                    source,
                    overrides,
                    `${row.id}:statement`,
                    row.statement,
                  )}
                  {overrides[`${row.id}:statement`] != null && (
                    <small> (excerpt)</small>
                  )}
                  {!assessed(row) && <small> · Not assessed</small>}
                </li>
              ))}
            </ol>
          </section>
        </div>
        <section className="report-discussion" data-fit="Selected assumptions">
          <h2>Selected for discussion</h2>
          {!rows.length && <p>No discussion items selected.</p>}
          <div className="report-rows">
            {rows.map((row) => (
              <article key={row.id} className="report-row">
                <h3>
                  {source.assumptions.findIndex((item) => item.id === row.id) +
                    1}
                  .{" "}
                  {reportText(
                    source,
                    overrides,
                    `${row.id}:statement`,
                    row.statement,
                  )}
                  {overrides[`${row.id}:statement`] != null && (
                    <small> (excerpt)</small>
                  )}
                </h3>
                <p>{scoreComparison(row)}</p>
                <p>
                  <strong>Next: </strong>
                  {reportText(
                    source,
                    overrides,
                    `${row.id}:nextStep`,
                    row.nextStep,
                  )}
                  {overrides[`${row.id}:nextStep`] != null && (
                    <small> (excerpt)</small>
                  )}
                </p>
                <p>
                  <strong>Help: </strong>
                  {reportText(
                    source,
                    overrides,
                    `${row.id}:helpNeeded`,
                    row.helpNeeded,
                  )}
                  {overrides[`${row.id}:helpNeeded`] != null && (
                    <small> (excerpt)</small>
                  )}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}
