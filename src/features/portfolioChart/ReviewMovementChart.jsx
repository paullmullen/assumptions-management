import { useEffect, useState } from "react";
import { Alert, Button, Checkbox, Space, Typography } from "antd";
import { loadReportReviews } from "../reports/reportService.js";
import PortfolioChart from "./PortfolioChart.jsx";
import { reviewMovement } from "./reviewMovement.js";
export default function ReviewMovementChart({
  projectId,
  portfolioLoadedAt = Infinity,
  onRefreshPortfolio,
  ...props
}) {
  const [enabled, setEnabled] = useState(false),
    [attempt, setAttempt] = useState(0),
    [state, setState] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    loadReportReviews(projectId)
      .then((reviews) => {
        if (active) setState({ review: reviews[0] ?? null });
      })
      .catch(() => {
        if (active) setState({ error: true });
      });
    return () => {
      active = false;
    };
  }, [projectId, enabled, attempt]);
  const newerReview = state?.review?.capturedAt > portfolioLoadedAt;
  const movement =
    enabled && state?.review && !newerReview
      ? reviewMovement(props.assumptions, state.review)
      : [];
  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <Checkbox
          checked={enabled}
          onChange={(event) => {
            setState(null);
            setEnabled(event.target.checked);
          }}
        >
          Show movement since last review
        </Checkbox>
        {enabled && (
          <Button
            onClick={() => {
              setState(null);
              setAttempt((value) => value + 1);
            }}
          >
            Refresh review baseline
          </Button>
        )}
      </Space>
      {enabled && !state && (
        <Typography.Paragraph role="status">
          Loading last saved review…
        </Typography.Paragraph>
      )}
      {enabled && state?.error && (
        <Alert
          role="alert"
          type="warning"
          title="The review baseline could not be loaded. Current positions are shown without movement."
          action={
            <Button
              onClick={() => {
                setState(null);
                setAttempt((value) => value + 1);
              }}
            >
              Retry movement
            </Button>
          }
        />
      )}
      {enabled && state && !state.error && !state.review && (
        <Typography.Paragraph role="status">
          No previous review. Save a formal review to establish a movement
          baseline.
        </Typography.Paragraph>
      )}
      {enabled && newerReview && (
        <Alert
          type="info"
          role="status"
          title="This review is newer than the portfolio currently loaded. Refresh the portfolio, then turn movement on again."
          action={
            <Button onClick={onRefreshPortfolio}>Refresh portfolio</Button>
          }
        />
      )}
      {enabled && state?.review && !newerReview && (
        <>
          <Typography.Paragraph>
            Since saved review “{state.review.title}” — captured{" "}
            {new Date(state.review.capturedAt).toLocaleString()}. Outline:
            previous position. Arrow: net movement to current scores. Movement
            does not imply approval or improvement.
          </Typography.Paragraph>
          <details style={{ marginBottom: 12 }}>
            <summary>
              Movement details ({movement.filter((row) => row.changed).length}{" "}
              moved)
            </summary>
            <ul>
              {movement.map((row) => (
                <li key={row.id}>
                  #{row.number} {row.to.statement}: {row.description}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      <PortfolioChart {...props} movement={movement} />
    </>
  );
}
