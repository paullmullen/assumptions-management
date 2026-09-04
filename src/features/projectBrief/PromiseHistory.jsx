import { useEffect, useState } from "react";
import { Alert, Button, Typography } from "antd";
import { loadPromiseHistory } from "../../services.js";

import { promiseLabels } from "./promiseLabels.js";
export default function PromiseHistory({ projectId, revision }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadPromiseHistory(projectId)
      .then((records) => {
        if (active) {
          setItems(records);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [projectId, revision, attempt]);
  return (
    <section aria-label="Promise wording history">
      <Typography.Paragraph type="secondary">
        Newest first. History begins with changes saved using this version;
        earlier changes are not reconstructed.
      </Typography.Paragraph>
      {status === "loading" && <p>Loading history…</p>}
      {status === "error" && (
        <Alert
          type="error"
          title="Promise history could not be loaded."
          action={
            <Button
              onClick={() => {
                setStatus("loading");
                setAttempt((value) => value + 1);
              }}
            >
              Retry history
            </Button>
          }
        />
      )}
      {status === "ready" && !items.length && (
        <p>No recorded promise changes yet.</p>
      )}
      {items.map((item) => (
        <article className="insight-history-entry" key={item.id}>
          {Object.entries(promiseLabels)
            .filter(([key]) => item.from[key] !== item.to[key])
            .map(([key, label]) => (
              <div key={key}>
                <Typography.Text strong>{label} promise</Typography.Text>
                <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
                  Previously: {item.from[key] || "Not set"}
                </Typography.Paragraph>
                <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
                  Now: {item.to[key] || "Not set"}
                </Typography.Paragraph>
              </div>
            ))}
          <Typography.Text type="secondary">
            {item.authorEmail || item.createdBy} ·{" "}
            {item.createdAt?.toDate
              ? item.createdAt.toDate().toLocaleString()
              : "Timestamp unavailable"}
          </Typography.Text>
        </article>
      ))}
    </section>
  );
}
