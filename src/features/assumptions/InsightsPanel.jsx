import { useEffect, useState } from "react";
import { Alert, Button, Card, Space, Spin, Tag, Typography } from "antd";
import { loadInsights } from "../../services.js";
import { isSourceUrl } from "./insightValues.js";

const emptyInsights = [];

export default function InsightsPanel({
  projectId,
  assumption,
  newInsights = emptyInsights,
}) {
  const [items, setItems] = useState([]);
  const visibleItems = [
    ...newInsights.filter(
      (entry) => !items.some((item) => item.id === entry.id),
    ),
    ...items,
  ];
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadInsights(projectId, assumption.id)
      .then((records) => {
        if (active) {
          setItems(records);
          setLoadError("");
        }
      })
      .catch((error) => {
        if (active)
          setLoadError(
            error.code === "permission-denied"
              ? "Access to insights was denied. Ask the project administrator to check access."
              : "Insights could not be loaded. Please try again.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, assumption.id, attempt, newInsights]);
  return (
    <Card
      title="Recorded insights and changes"
      extra={<Typography.Text type="secondary">Newest first</Typography.Text>}
      style={{ gridColumn: "1 / -1" }}
    >
      <Typography.Paragraph type="secondary">
        Wording history begins with changes saved using this version; earlier
        changes are not reconstructed.
      </Typography.Paragraph>
      {loading ? (
        <Spin />
      ) : loadError ? (
        <Alert
          type="error"
          role="alert"
          title={loadError}
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
      ) : visibleItems.length === 0 ? (
        <Typography.Paragraph type="secondary">
          No insights yet.
        </Typography.Paragraph>
      ) : null}
      {visibleItems.map((item) => (
        <article
          key={item.id}
          aria-label="Recorded insight"
          className="insight-history-entry"
        >
          {item.description && (
            <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
              {item.description}
            </Typography.Paragraph>
          )}
          {item.wordingChange && (
            <div>
              <Typography.Text strong>Assumption wording</Typography.Text>
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
                Previously: {item.wordingChange.from}
              </Typography.Paragraph>
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
                Now: {item.wordingChange.to}
              </Typography.Paragraph>
            </div>
          )}
          {item.scoreChange && (
            <Space orientation="vertical" size={0} style={{ marginBottom: 8 }}>
              {Object.entries({
                criticality: "Criticality",
                evidence: "Evidence",
              }).map(([axis, label]) => (
                <Typography.Text key={axis}>
                  {label}: {item.scoreChange.from[axis] ?? "Not assessed"} →{" "}
                  {item.scoreChange.to[axis]}
                  {item.scoreChange.from[axis] === item.scoreChange.to[axis]
                    ? " (unchanged)"
                    : ""}
                </Typography.Text>
              ))}
            </Space>
          )}
          {item.managementChange &&
            Object.entries({ nextStep: "Next step", helpNeeded: "Help needed" })
              .filter(
                ([key]) =>
                  item.managementChange.from[key] !==
                  item.managementChange.to[key],
              )
              .map(([key, label]) => (
                <div key={key} style={{ marginBottom: 8 }}>
                  <Typography.Text strong>{label}</Typography.Text>
                  <Typography.Paragraph
                    style={{ whiteSpace: "pre-wrap", marginBottom: 4 }}
                  >
                    Previously: {item.managementChange.from[key] || "Not set"}
                  </Typography.Paragraph>
                  <Typography.Paragraph
                    style={{ whiteSpace: "pre-wrap", marginBottom: 4 }}
                  >
                    Now: {item.managementChange.to[key] || "Not set"}
                  </Typography.Paragraph>
                </div>
              ))}
          <Space wrap style={{ display: "flex" }}>
            <Typography.Text type="secondary">
              {item.authorEmail || item.createdBy} ·{" "}
              {item.createdAt?.toDate
                ? item.createdAt.toDate().toLocaleString()
                : "Saved just now"}
            </Typography.Text>
            {item.classification && <Tag>{item.classification}</Tag>}
            {item.sourceUrl && isSourceUrl(item.sourceUrl) && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Source
              </a>
            )}
          </Space>
        </article>
      ))}
    </Card>
  );
}
