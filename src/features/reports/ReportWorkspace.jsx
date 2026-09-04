import { comparisonBaseline } from "./reportComparison.js";
import { reportFitMessage } from "./reportValues.js";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Input,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import { useDraft, useNavigationGuard } from "../workspace/draftContext.js";
import {
  loadReportReviews,
  loadReportSource,
  verifyReportAccess,
} from "./reportService.js";
import {
  fieldText,
  fitProblems,
  promiseLabels,
  rowLabels,
  sortedReportRows,
} from "./reportValues.js";
import ReportPreview from "./ReportPreview.jsx";
import "./reports.css";

export default function ReportWorkspace({ project }) {
  const [request, setRequest] = useState({ id: "current", revision: 0 });
  const [source, setSource] = useState(null);
  const [showMovement, setShowMovement] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [order, setOrder] = useState("number");
  const [problems, setProblems] = useState(["Preview is not ready."]);
  const [printReady, setPrintReady] = useState(null);
  const baseline = source ? comparisonBaseline(source, reviews) : null;
  const newerBaseline =
    source?.kind === "current" && baseline?.capturedAt > source.loadedAt;
  const movementReview = showMovement && !newerBaseline ? baseline : null;
  const preview = useRef(null);
  const guard = useNavigationGuard();
  useDraft("Project brief selections and excerpts", {
    dirty: selected.length > 0 || Object.keys(overrides).length > 0,
    busy: busy || Boolean(printReady),
    discard: () => {
      setSelected([]);
      setOverrides({});
    },
  });
  useEffect(() => {
    let active = true;
    Promise.all([
      loadReportSource(project.id, request.id),
      loadReportReviews(project.id),
    ])
      .then(([data, items]) => {
        if (!active) return;
        setSource(data);
        setReviews(items);
        setSelected([]);
        setOverrides({});
        setError("");
      })
      .catch(() => {
        if (active) {
          setSource(null);
          setError(
            "The report could not be loaded. Check your connection and project access, then retry.",
          );
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [project.id, request]);
  useEffect(() => {
    let frame;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setProblems(fitProblems(preview.current)),
      );
    };
    check();
    const observer = new ResizeObserver(check);
    if (preview.current) observer.observe(preview.current);
    let active = true;
    document.fonts?.ready.then(() => {
      if (active) check();
    });
    window.addEventListener("resize", check);
    return () => {
      active = false;
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", check);
    };
  }, [source, selected, overrides, busy, showMovement, movementReview]);
  useEffect(() => {
    if (!printReady) return;
    const frame = requestAnimationFrame(() => {
      const issues = fitProblems(preview.current);
      try {
        if (!issues.length) window.print();
        else setProblems(issues);
      } catch {
        setError("The browser print dialog could not open. Please try again.");
      } finally {
        setPrintReady(null);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [printReady]);
  function reload(id = request.id) {
    guard(() => {
      setBusy(true);
      setError("");
      setRequest((value) => ({ id, revision: value.revision + 1 }));
    });
  }
  function edit(key, value, original) {
    setOverrides((current) => {
      const next = { ...current };
      if (value === original) delete next[key];
      else next[key] = value;
      return next;
    });
  }
  async function print() {
    const issues = fitProblems(preview.current);
    setProblems(issues);
    if (issues.length || !source || busy || error) return;
    setBusy(true);
    try {
      await verifyReportAccess(project.id);
      setPrintReady({
        source,
        movementReview,
        selected: [...selected],
        overrides: { ...overrides },
      });
    } catch {
      setError(
        "Printing is blocked because project access could not be verified. Refresh the report to retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || Boolean(printReady);
  const editor = (key, label, value) => {
    const original = fieldText(source, value);
    return (
      <label key={key} className="report-edit-field">
        {label}
        <Input.TextArea
          aria-label={`Report excerpt: ${label}`}
          value={overrides[key] ?? original}
          disabled={disabled}
          autoSize={{ minRows: 1, maxRows: 5 }}
          onChange={(event) => edit(key, event.target.value, original)}
        />
        {overrides[key] != null && (
          <Button
            size="small"
            disabled={disabled}
            onClick={() => edit(key, original, original)}
          >
            Restore source: {label}
          </Button>
        )}
      </label>
    );
  };
  return (
    <section
      id="project-report"
      tabIndex={-1}
      aria-label="Project brief workspace"
    >
      <Typography.Title level={2}>Project brief</Typography.Title>
      <Typography.Paragraph>
        Choose what deserves discussion. The preview uses saved data; changing
        the report does not edit your project.
      </Typography.Paragraph>
      <Space wrap className="report-controls">
        <Select
          id="report-source"
          aria-label="Report source"
          disabled={disabled}
          value={request.id}
          onChange={reload}
          options={[
            { value: "current", label: "Current saved state" },
            ...reviews.map((review) => ({
              value: review.id,
              label: `Saved review: ${review.title}`,
            })),
          ]}
        />
        <Button disabled={disabled} onClick={() => reload()}>
          Refresh report
        </Button>
        <Button
          type="primary"
          disabled={
            disabled || !source || Boolean(error) || problems.length > 0
          }
          onClick={print}
        >
          Print / Save as PDF
        </Button>
      </Space>
      <Checkbox
        checked={showMovement}
        disabled={disabled}
        onChange={(event) => setShowMovement(event.target.checked)}
      >
        Show movement since last review
      </Checkbox>
      {showMovement && !busy && source && !baseline && (
        <p role="status">
          No previous review. Positions are shown without movement.
        </p>
      )}
      {showMovement && !busy && newerBaseline && (
        <p role="status">
          The review is newer than this report. Use Refresh report before
          showing movement.
        </p>
      )}
      {error && (
        <Alert
          role="alert"
          type="error"
          title={error}
          action={
            <Button disabled={disabled} onClick={() => reload()}>
              Retry report
            </Button>
          }
        />
      )}
      {busy && <Spin aria-label="Loading report" />}
      {source && (
        <>
          <div className="report-setup">
            <div>
              <Typography.Title level={3}>
                Select up to four assumptions
              </Typography.Title>
              <Select
                id="report-sort"
                aria-label="Sort report assumptions"
                value={order}
                onChange={setOrder}
                disabled={disabled}
                options={[
                  { value: "number", label: "Assumption number" },
                  { value: "attention", label: "Attention priority" },
                ]}
              />
              <p>
                Selection order is report order. Use Up/Down to reorder; chart
                numbers stay fixed.
              </p>
              <div className="report-selection">
                {sortedReportRows(source.assumptions, order).map((row) => (
                  <div key={row.id}>
                    <Checkbox
                      checked={selected.includes(row.id)}
                      disabled={
                        disabled ||
                        (selected.length === 4 && !selected.includes(row.id))
                      }
                      onChange={(event) =>
                        setSelected((ids) =>
                          event.target.checked
                            ? [...ids, row.id]
                            : ids.filter((id) => id !== row.id),
                        )
                      }
                    >
                      {row.number}. {row.statement}
                    </Checkbox>
                  </div>
                ))}
                {!source.assumptions.length && (
                  <p>No active assumptions in this source.</p>
                )}
              </div>
              {selected.map((id, index) => (
                <Space key={id}>
                  <span>
                    #{source.assumptions.findIndex((row) => row.id === id) + 1}
                  </span>
                  {[
                    [-1, "Up"],
                    [1, "Down"],
                  ].map(([delta, label]) => (
                    <Button
                      key={label}
                      size="small"
                      aria-label={`${label} assumption ${source.assumptions.findIndex((row) => row.id === id) + 1}`}
                      disabled={
                        disabled ||
                        index + delta < 0 ||
                        index + delta >= selected.length
                      }
                      onClick={() =>
                        setSelected((ids) => {
                          const next = [...ids];
                          [next[index], next[index + delta]] = [
                            next[index + delta],
                            next[index],
                          ];
                          return next;
                        })
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </Space>
              ))}
            </div>
            <Collapse
              items={[
                {
                  key: "excerpts",
                  label: "Shorten text for this report",
                  children: (
                    <>
                      <p>
                        Edited text is labeled “excerpt” in the report. Full
                        source wording remains unchanged.
                      </p>
                      {editor(
                        "projectName",
                        "Project name",
                        source.projectName,
                      )}
                      {source.kind === "review" &&
                        editor("reviewTitle", "Review title", source.title)}
                      {Object.entries(promiseLabels).map(([key, label]) =>
                        editor(key, `${label} promise`, source.promises?.[key]),
                      )}
                      {source.assumptions.map((row) => {
                        const id = row.id;
                        return Object.entries(rowLabels)
                          .filter(
                            ([key]) =>
                              key === "statement" || selected.includes(id),
                          )
                          .map(([key, label]) =>
                            editor(
                              `${id}:${key}`,
                              `#${source.assumptions.indexOf(row) + 1} ${label}`,
                              row[key],
                            ),
                          );
                      })}
                    </>
                  ),
                },
              ]}
            />
          </div>
          {problems.length > 0 && !busy && (
            <Alert
              role="alert"
              type="warning"
              title="Adjust the report before printing"
              description={reportFitMessage(problems, selected.length)}
            />
          )}
          <p className="report-print-help">
            16:9 landscape preview. On a narrow screen, scroll horizontally.
            Save as PDF to preserve the widescreen page. For paper, choose
            landscape and scale to fit the paper; turn off browser
            headers/footers.
          </p>
          <div className="report-preview-scroll">
            <div ref={preview} className="report-measure">
              <ReportPreview
                movementReview={movementReview}
                source={source}
                selected={selected}
                overrides={overrides}
              />
            </div>
          </div>
        </>
      )}
      {createPortal(
        <div id="project-brief-print">
          {printReady ? (
            <ReportPreview {...printReady} />
          ) : (
            <p>
              Open Project brief and use Print / Save as PDF to check page fit
              and project access before printing.
            </p>
          )}
        </div>,
        document.body,
      )}
    </section>
  );
}
