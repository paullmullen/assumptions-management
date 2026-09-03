import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Collapse,
  Input,
  Modal,
  Space,
  Table,
  Typography,
} from "antd";
import {
  captureReview,
  loadReviews,
  newReviewId,
  publishReview,
} from "./reviewService.js";
import { compareReview, reviewFields } from "./reviewValues.js";

const display = (value) =>
  value === null ? "Not assessed" : value === "" ? "Not set" : value;

function ReviewContents({ snapshot, previous }) {
  const rows = compareReview(snapshot, previous);
  return (
    <>
      <Typography.Paragraph>
        {previous
          ? `Compared with “${previous.title}”.`
          : "First review: no prior published review to compare with."}
      </Typography.Paragraph>
      <Collapse
        items={[
          {
            key: "promises",
            label: "Three Promises",
            children: Object.entries({
              customerPromise: "Customer",
              investorPromise: "Investor",
              coworkerPromise: "Coworker / culture",
            }).map(([key, label]) => (
              <Typography.Paragraph key={key}>
                <strong>{label}: </strong>
                {snapshot.promises[key] || "Not set"}
              </Typography.Paragraph>
            )),
          },
        ]}
      />
      <Table
        rowKey="id"
        dataSource={rows}
        pagination={false}
        scroll={{ x: 620 }}
        columns={[
          { title: "Assumption", dataIndex: "statement" },
          { title: "Criticality", dataIndex: "criticality", render: display },
          { title: "Evidence", dataIndex: "evidence", render: display },
          {
            title: "Since previous review",
            render: (_, row) =>
              row.status !== "Existing"
                ? row.status
                : `${row.changes.length} field changes; ${row.newInsights.length} new records`,
          },
        ]}
        expandable={{
          expandedRowRender: (row) => (
            <>
              {row.changes.map(({ key, from, to }) => (
                <Typography.Paragraph
                  key={key}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  <strong>{reviewFields[key]}: </strong>
                  {display(from)} → {display(to)}
                </Typography.Paragraph>
              ))}
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
                <strong>Next step: </strong>
                {row.nextStep || "Not set"}
              </Typography.Paragraph>
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
                <strong>Help needed: </strong>
                {row.helpNeeded || "Not set"}
              </Typography.Paragraph>
              {row.newInsights.map((item) => (
                <div key={item.id} style={{ marginBottom: 12 }}>
                  <Typography.Paragraph
                    style={{ whiteSpace: "pre-wrap", marginBottom: 4 }}
                  >
                    {item.description || "Recorded change"}
                  </Typography.Paragraph>
                  {item.scoreChange && (
                    <Typography.Paragraph>
                      Criticality: {display(item.scoreChange.from.criticality)}{" "}
                      → {display(item.scoreChange.to.criticality)}; Evidence:{" "}
                      {display(item.scoreChange.from.evidence)} →{" "}
                      {display(item.scoreChange.to.evidence)}
                    </Typography.Paragraph>
                  )}
                  {item.managementChange &&
                    ["nextStep", "helpNeeded"]
                      .filter(
                        (key) =>
                          item.managementChange.from[key] !==
                          item.managementChange.to[key],
                      )
                      .map((key) => (
                        <Typography.Paragraph key={key}>
                          {reviewFields[key]}:{" "}
                          {display(item.managementChange.from[key])} →{" "}
                          {display(item.managementChange.to[key])}
                        </Typography.Paragraph>
                      ))}
                  <Typography.Text type="secondary">
                    {item.authorEmail || item.createdBy} ·{" "}
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString()
                      : "Time unavailable"}
                    {item.classification ? ` · ${item.classification}` : ""}
                  </Typography.Text>
                  {/^https?:\/\//.test(item.sourceUrl ?? "") && (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Source
                      </a>
                    </>
                  )}
                </div>
              ))}
            </>
          ),
        }}
      />
    </>
  );
}

export default function ReviewsPanel({ projectId, user }) {
  const [reviews, setReviews] = useState([]);
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadReviews(projectId)
      .then((items) => {
        if (active) setReviews(items);
      })
      .catch(() => {
        if (active) setError("Reviews could not be loaded. Please retry.");
      });
    return () => {
      active = false;
    };
  }, [projectId, attempt]);

  async function start(refresh = false) {
    setBusy(true);
    setError("");
    try {
      const captured = await captureReview(projectId);
      setDraft({
        ...captured,
        id: refresh ? draft.id : newReviewId(projectId),
        title: refresh
          ? draft.title
          : `Review — ${new Date().toLocaleDateString()}`,
        notes: refresh ? draft.notes : "",
      });
    } catch {
      setError("The review could not be prepared. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError("");
    try {
      await publishReview(user, projectId, draft.id, {
        ...draft.snapshot,
        title: draft.title,
        notes: draft.notes,
        previousReviewId: draft.previous?.id ?? null,
      });
    } catch (cause) {
      setError(
        cause.code
          ? "The review could not be published. Your draft is retained; please retry."
          : cause.message,
      );
      setBusy(false);
      return;
    }
    setDraft(null);
    try {
      setReviews(await loadReviews(projectId));
    } catch {
      setError(
        "Review published, but the list could not be refreshed. Please retry loading.",
      );
    } finally {
      setBusy(false);
    }
  }

  const selectedPrevious =
    reviews.find((item) => item.id === selected?.previousReviewId) ?? null;
  return (
    <Card title="Formal reviews" style={{ marginTop: 24 }}>
      <Typography.Paragraph>
        Preserve the portfolio you reviewed and see what changed next time.
      </Typography.Paragraph>
      {error && (
        <Alert
          role="alert"
          type="error"
          title={error}
          action={
            <Button
              onClick={() => {
                setError("");
                setAttempt((value) => value + 1);
              }}
            >
              Retry loading
            </Button>
          }
        />
      )}
      <Button type="primary" loading={busy} onClick={() => start()}>
        Start review
      </Button>
      {!reviews.length && (
        <Typography.Paragraph>No published reviews yet.</Typography.Paragraph>
      )}
      {reviews.map((review) => (
        <div key={review.id}>
          <Button type="link" onClick={() => setSelected(review)}>
            {review.title}
          </Button>
          <Typography.Text type="secondary">
            {review.publisherEmail} ·{" "}
            {review.publishedAt.toDate().toLocaleString()}
          </Typography.Text>
        </div>
      ))}
      <Modal
        title="Review current portfolio"
        open={Boolean(draft)}
        width={1000}
        closable={!busy}
        maskClosable={false}
        keyboard={!busy}
        onCancel={() => setDraft(null)}
        footer={
          draft && (
            <Space>
              <Button disabled={busy} onClick={() => setDraft(null)}>
                Cancel review
              </Button>
              <Button disabled={busy} onClick={() => start(true)}>
                Refresh saved state
              </Button>
              <Button
                type="primary"
                loading={busy}
                disabled={!draft.title.trim()}
                onClick={publish}
              >
                Publish review
              </Button>
            </Space>
          )
        }
      >
        {draft && (
          <>
            <Typography.Paragraph>
              Captured {new Date(draft.snapshot.capturedAt).toLocaleString()}.
              Publish preserves the saved state shown below. Unsaved edits are
              excluded; later project changes remain editable.
            </Typography.Paragraph>
            {error && <Alert role="alert" title={error} type="error" />}
            <label htmlFor="review-title">Review title</label>
            <Input
              id="review-title"
              value={draft.title}
              maxLength={120}
              disabled={busy}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />
            <label htmlFor="review-notes">Review notes (optional)</label>
            <Input.TextArea
              id="review-notes"
              rows={3}
              value={draft.notes}
              maxLength={4000}
              disabled={busy}
              onChange={(event) =>
                setDraft({ ...draft, notes: event.target.value })
              }
            />
            <ReviewContents
              snapshot={draft.snapshot}
              previous={draft.previous}
            />
          </>
        )}
      </Modal>
      <Modal
        title={selected?.title}
        open={Boolean(selected)}
        width={1000}
        onCancel={() => setSelected(null)}
        footer={<Button onClick={() => setSelected(null)}>Close</Button>}
      >
        {selected && (
          <>
            <Typography.Paragraph>
              Published by {selected.publisherEmail} ·{" "}
              {selected.publishedAt.toDate().toLocaleString()}
            </Typography.Paragraph>
            <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
              {selected.notes}
            </Typography.Paragraph>
            <ReviewContents snapshot={selected} previous={selectedPrevious} />
          </>
        )}
      </Modal>
    </Card>
  );
}
