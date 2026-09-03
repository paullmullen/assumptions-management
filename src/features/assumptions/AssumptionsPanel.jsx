import { useEffect, useRef, useState } from "react";
import { Alert, Button, Empty, Space, Spin, Tag, Typography } from "antd";
import { loadAssumptions, loadInsights } from "../../services.js";
import { useNavigationGuard } from "../workspace/draftContext.js";
import PortfolioChart from "../portfolioChart/PortfolioChart.jsx";
import CandidatesPanel from "../candidates/CandidatesPanel.jsx";
import AssumptionDrawer from "./AssumptionDrawer.jsx";

import {
  activityTime,
  portfolioSortOptions,
  sortPortfolio,
} from "./portfolioSort.js";

function scoreColor(score, evidence = false) {
  if (!Number.isInteger(score)) return undefined;
  return score >= 66
    ? evidence
      ? "green"
      : "red"
    : score >= 33
      ? "gold"
      : evidence
        ? "red"
        : "green";
}
export default function AssumptionsPanel(props) {
  return <ProjectAssumptions key={props.projectId} {...props} />;
}
function ProjectAssumptions({
  projectId,
  user,
  view = "portfolio",
  desktop = false,
  onDrawerChange,
  onAdopted,
  onCandidateCount,
}) {
  const guard = useNavigationGuard();
  const [assumptions, setAssumptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [order, setOrder] = useState("number");
  const [activity, setActivity] = useState(null);
  const [activityAttempt, setActivityAttempt] = useState(0);
  const [localActivity, setLocalActivity] = useState({});
  const activityReady = activity?.source === assumptions && !activity.error;
  useEffect(() => {
    if (order !== "recent" || loading) return;
    let active = true;
    Promise.all(
      assumptions.map(async (item) => [
        item.id,
        activityTime(item, await loadInsights(projectId, item.id)),
      ]),
    )
      .then((entries) => {
        if (active)
          setActivity({
            source: assumptions,
            dates: Object.fromEntries(entries),
          });
      })
      .catch(() => {
        if (active) setActivity({ source: assumptions, error: true });
      });
    return () => {
      active = false;
    };
  }, [order, loading, assumptions, projectId, activityAttempt]);
  const activityDates = Object.fromEntries(
    assumptions.map((item) => [
      item.id,
      Math.max(activity?.dates?.[item.id] ?? 0, localActivity[item.id] ?? 0),
    ]),
  );
  const rows = sortPortfolio(
    assumptions,
    order === "recent" && !activityReady ? "number" : order,
    activityDates,
  );
  const [selectedId, setSelectedId] = useState(null);
  const [editor, setEditor] = useState(null);
  const trigger = useRef(null);
  const visible = Boolean(editor && view === "portfolio");
  useEffect(() => {
    onDrawerChange?.(visible);
    return () => onDrawerChange?.(false);
  }, [visible, onDrawerChange]);
  useEffect(() => {
    let active = true;
    loadAssumptions(projectId)
      .then((items) => {
        if (active) {
          setAssumptions(items);
          setError("");
        }
      })
      .catch(() => {
        if (active) setError("Assumptions could not be loaded. Please retry.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, attempt]);
  function select(id, element) {
    if (editor?.id === id && visible) return;
    guard(() => {
      trigger.current = element ?? document.activeElement;
      setSelectedId(id);
      setEditor({ id });
    });
  }
  function close() {
    setEditor(null);
    requestAnimationFrame(() => {
      if (trigger.current?.isConnected)
        trigger.current.focus({ preventScroll: true });
      else
        document
          .getElementById("project-assumptions")
          ?.focus({ preventScroll: true });
    });
  }
  function saved(assumption, didSave = false) {
    if (didSave)
      setLocalActivity((current) => ({
        ...current,
        [assumption.id]: Date.now(),
      }));
    setAssumptions((current) =>
      current.some((item) => item.id === assumption.id)
        ? current.map((item) => (item.id === assumption.id ? assumption : item))
        : [...current, assumption],
    );
    setSelectedId(assumption.id);
  }
  const selected = assumptions.find((item) => item.id === editor?.id);
  const assumptionList = (
    <div className="workspace-assumption-list" aria-label="Active assumptions">
      <div className="portfolio-sort-controls">
        <label htmlFor="portfolio-sort">Sort assumptions</label>
        <select
          id="portfolio-sort"
          value={order}
          onChange={(event) => setOrder(event.target.value)}
        >
          {portfolioSortOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {order === "attention" && (
          <p>
            Unassessed first. Then criticality minus evidence, highest first,
            matching the chart’s diagonal risk direction. Equal priorities keep
            assumption-number order.
          </p>
        )}
        {["criticality", "evidence"].includes(order) && (
          <p>Unassessed assumptions first; scored assumptions follow.</p>
        )}
        {order === "recent" && (
          <p>
            Includes wording, scores, next steps, help needed, and recorded
            insights. Unknown dates appear last.
          </p>
        )}
        {order === "recent" &&
          !activityReady &&
          (activity?.source === assumptions && activity.error ? (
            <Alert
              type="error"
              title="Recent changes could not be loaded. Showing assumption-number order."
              action={
                <Button
                  onClick={() => {
                    setActivity(null);
                    setActivityAttempt((value) => value + 1);
                  }}
                >
                  Retry recent changes
                </Button>
              }
            />
          ) : (
            <span role="status">
              Loading recent changes… Showing assumption-number order.
            </span>
          ))}
      </div>
      {!assumptions.length ? (
        <Empty description="No assumptions yet" />
      ) : (
        <ol className="portfolio-assumption-list">
          {rows.map(({ assumption, number }) => (
            <li
              key={assumption.id}
              role="group"
              aria-label={`Saved assumption: ${assumption.statement}`}
              className={`saved-assumption${selectedId === assumption.id ? " saved-assumption-selected" : ""}`}
            >
              <button
                className="assumption-row-button"
                type="button"
                aria-label={`Open assumption ${number}: ${assumption.statement}`}
                aria-pressed={selectedId === assumption.id}
                onClick={(event) => select(assumption.id, event.currentTarget)}
              >
                <span className="assumption-row-statement">
                  <span className="portfolio-key-number">{number}</span>
                  <span>{assumption.statement}</span>
                </span>
                <span className="assumption-row-scores">
                  <Tag color={scoreColor(assumption.criticality)}>
                    Criticality: {assumption.criticality ?? "Not assessed"}
                  </Tag>
                  <Tag color={scoreColor(assumption.evidence, true)}>
                    Evidence: {assumption.evidence ?? "Not assessed"}
                  </Tag>
                  {assumption.sourceCandidateId && <Tag>Adopted candidate</Tag>}
                  {order === "recent" && activityReady && (
                    <span>
                      Last change:{" "}
                      {activityDates[assumption.id]
                        ? new Date(
                            activityDates[assumption.id],
                          ).toLocaleString()
                        : "Date unavailable"}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
  return (
    <>
      <section
        id="project-candidates"
        tabIndex={-1}
        aria-label="Project candidates"
        hidden={view !== "candidates"}
      >
        <CandidatesPanel
          projectId={projectId}
          user={user}
          expanded={view === "candidates"}
          onCountChange={onCandidateCount}
          onAdopt={(active) => {
            saved(active, true);
            setEditor({ id: active.id });
            onAdopted?.();
          }}
        />
      </section>
      <section
        id="project-assumptions"
        tabIndex={-1}
        aria-label="Assumption portfolio"
        hidden={view !== "portfolio"}
      >
        <div className="portfolio-toolbar">
          <Typography.Title level={2}>Portfolio</Typography.Title>
          <Space wrap>
            <Typography.Text>
              {loading
                ? "Loading assumptions…"
                : `${assumptions.length} active assumptions`}
            </Typography.Text>
            <Button
              type="primary"
              disabled={loading || Boolean(error)}
              onClick={(event) => {
                const element = event.currentTarget;
                guard(() => {
                  trigger.current = element;
                  setEditor({ id: crypto.randomUUID() });
                });
              }}
            >
              Add assumption
            </Button>
          </Space>
        </div>
        {assumptions.length > 12 && (
          <Typography.Paragraph className="portfolio-size-guidance">
            There are {assumptions.length} active assumptions. About 12 often
            keeps a portfolio manageable; keep more when useful.
          </Typography.Paragraph>
        )}
        {loading ? (
          <Spin aria-label="Loading assumptions" />
        ) : error ? (
          <Alert
            type="error"
            title={error}
            action={
              <Button
                onClick={() => {
                  setLoading(true);
                  setAttempt((value) => value + 1);
                }}
              >
                Retry
              </Button>
            }
          />
        ) : (
          <PortfolioChart
            assumptions={assumptions}
            selectedId={selectedId}
            onSelect={select}
            assumptionList={assumptionList}
          />
        )}
      </section>
      {visible && (
        <AssumptionDrawer
          key={editor.id}
          projectId={projectId}
          user={user}
          assumption={selected}
          assumptionId={editor.id}
          number={
            selected
              ? assumptions.findIndex((item) => item.id === editor.id) + 1
              : null
          }
          desktop={desktop}
          onSaved={saved}
          onClose={close}
        />
      )}
    </>
  );
}
