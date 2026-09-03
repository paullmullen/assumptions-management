import { useEffect, useState } from "react";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Input,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  addCandidates,
  adoptCandidate,
  editCandidate,
  loadCandidates,
} from "../../services.js";
import { useDraft, useNavigationGuard } from "../workspace/draftContext.js";
import { wordingHint } from "./candidateValues.js";

export default function CandidatesPanel({
  projectId,
  user,
  onAdopt,
  expanded,
  onCountChange,
}) {
  const [internalOpen, setOpen] = useState(false);
  const [internalVisited, setVisited] = useState(false);
  const open = expanded ?? internalOpen;
  const visited = expanded !== undefined || internalVisited;
  return (
    <Card
      className="candidate-panel"
      title="Candidate workshop"
      extra={
        expanded === undefined && (
          <Button
            aria-expanded={open}
            onClick={() => {
              setVisited(true);
              setOpen(!open);
            }}
          >
            {open ? "Hide candidates" : "Open candidates"}
          </Button>
        )
      }
    >
      <Typography.Paragraph style={{ marginBottom: 0 }}>
        Collect ideas here before adding them to the active portfolio. Adopt
        candidates when you are ready to assess them.
      </Typography.Paragraph>
      <div hidden={!open}>
        {visited && (
          <CandidateWorkshop
            key={projectId}
            projectId={projectId}
            user={user}
            onAdopt={onAdopt}
            onCountChange={onCountChange}
          />
        )}
      </div>
    </Card>
  );
}

function CandidateWorkshop({ projectId, user, onAdopt, onCountChange }) {
  const guard = useNavigationGuard();
  const { message } = AntApp.useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(null);
  const [statement, setStatement] = useState("");
  const [revision, setRevision] = useState(0);
  const [showAdopted, setShowAdopted] = useState(false);
  useEffect(() => {
    let active = true;
    loadCandidates(projectId)
      .then((records) => {
        if (active) {
          setItems(records);
          setError("");
        }
      })
      .catch(() => {
        if (active)
          setError("Candidates could not be loaded. Refresh to try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, revision]);
  async function perform(action) {
    setBusy(true);
    try {
      await action();
      return true;
    } catch (cause) {
      message.error(
        cause.code
          ? "The change could not be saved. Check your access and refresh candidates before retrying."
          : cause.message,
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!loading && !error)
      onCountChange?.(items.filter((item) => item.status === "pending").length);
  }, [items, loading, error, onCountChange]);
  async function saveCapture() {
    if (loading || error || busy) return false;
    return perform(async () => {
      const added = await addCandidates(user, projectId, text);
      setItems((current) => [...current, ...added]);
      setText("");
      message.success("Candidates saved.");
    });
  }
  async function saveWording() {
    if (!statement.trim() || busy) return false;
    return perform(async () => {
      const saved = await editCandidate(user, projectId, editing, statement);
      setItems((current) =>
        current.map((row) =>
          row.id === editing ? { ...row, statement: saved } : row,
        ),
      );
      setEditing(null);
    });
  }
  useDraft("Candidate capture", {
    dirty: Boolean(text),
    busy,
    save: saveCapture,
    discard: () => setText(""),
  });
  useDraft("Candidate wording", {
    dirty:
      editing !== null &&
      statement !== items.find((item) => item.id === editing)?.statement,
    busy,
    save: saveWording,
    discard: () => setEditing(null),
  });
  function refresh() {
    setLoading(true);
    setRevision((value) => value + 1);
  }
  const visible = items.filter(
    (item) => showAdopted || item.status === "pending",
  );
  return (
    <div style={{ marginTop: 16 }}>
      <label htmlFor="candidate-entry">
        Candidate assumptions — one per line
      </label>
      <Input.TextArea
        id="candidate-entry"
        rows={4}
        value={text}
        disabled={busy}
        onChange={(event) => setText(event.target.value)}
      />
      <Typography.Paragraph type="secondary">
        State what is true—or must become true—to deliver the promises. Save up
        to 20 at a time, with 2,000 characters per candidate. No scores
        required.
      </Typography.Paragraph>
      {text.split(/\r?\n/).some(wordingHint) && (
        <Alert
          type="info"
          title="Some lines look like questions or tasks. Consider stating what must be true. You can still save them as written."
        />
      )}
      <Space wrap style={{ margin: "12px 0" }}>
        <Button
          type="primary"
          disabled={loading || Boolean(error) || busy || !text.trim()}
          onClick={saveCapture}
        >
          Save candidates
        </Button>
        <Button disabled={busy || loading} onClick={refresh}>
          Refresh candidates
        </Button>
        <Button
          disabled={busy}
          aria-pressed={showAdopted}
          onClick={() => setShowAdopted(!showAdopted)}
        >
          {showAdopted ? "Hide adopted" : "Show adopted"}
        </Button>
      </Space>
      {error && <Alert type="error" title={error} />}
      {loading ? (
        <Spin />
      ) : (
        !error && (
          <>
            {!visible.length && (
              <Typography.Paragraph>
                No {showAdopted ? "" : "pending "}candidates.
              </Typography.Paragraph>
            )}
            {visible.map((item) => (
              <div
                key={item.id}
                className="candidate-row"
                role="group"
                aria-label={`Candidate: ${item.statement}`}
              >
                {editing === item.id ? (
                  <>
                    <Input.TextArea
                      aria-label="Edit candidate statement"
                      value={statement}
                      maxLength={2000}
                      disabled={busy}
                      onChange={(event) => setStatement(event.target.value)}
                    />
                    <Space wrap>
                      <Button
                        disabled={busy || !statement.trim()}
                        onClick={saveWording}
                      >
                        Save wording
                      </Button>
                      <Button
                        disabled={busy}
                        onClick={() => guard(() => setEditing(null))}
                      >
                        Cancel
                      </Button>
                    </Space>
                  </>
                ) : (
                  <>
                    <Typography.Paragraph>
                      {item.statement}
                    </Typography.Paragraph>
                    <Typography.Paragraph type="secondary">
                      Added by {item.authorEmail || item.createdBy}
                      {item.createdAt?.toDate
                        ? ` · ${item.createdAt.toDate().toLocaleString()}`
                        : " · Just saved"}
                    </Typography.Paragraph>
                    {item.status === "adopted" ? (
                      <>
                        <Tag>Adopted</Tag>
                        <Typography.Text type="secondary">
                          Active assumption retains this candidate’s origin.
                        </Typography.Text>
                      </>
                    ) : (
                      <Space wrap>
                        <Button
                          disabled={busy || editing !== null}
                          onClick={() => {
                            setEditing(item.id);
                            setStatement(item.statement);
                          }}
                        >
                          Edit candidate
                        </Button>
                        <Button
                          disabled={busy || editing !== null}
                          onClick={() =>
                            guard(() =>
                              perform(async () => {
                                const active = await adoptCandidate(
                                  user,
                                  projectId,
                                  item.id,
                                  item.statement,
                                );
                                setItems((current) =>
                                  current.map((row) =>
                                    row.id === item.id
                                      ? { ...row, status: "adopted" }
                                      : row,
                                  ),
                                );
                                onAdopt(active);
                                message.success(
                                  "Adopted into the active portfolio.",
                                );
                              }),
                            )
                          }
                        >
                          Adopt into portfolio
                        </Button>
                      </Space>
                    )}
                  </>
                )}
              </div>
            ))}
          </>
        )
      )}
    </div>
  );
}
