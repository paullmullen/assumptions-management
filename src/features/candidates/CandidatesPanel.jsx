import CandidateBoard, { CandidateOrigins } from "./CandidateBoard.jsx";
import {
  combineCandidates,
  loadCandidateGroups,
  moveCandidate,
  newBoardId,
  saveCandidateGroup,
} from "./boardService.js";
import { moveOrder } from "./boardValues.js";
import { useEffect, useId, useState } from "react";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Drawer,
  Segmented,
  Input,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  addCandidates,
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
  adoptingId,
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
        candidates by entering both initial scores before saving.
      </Typography.Paragraph>
      <div hidden={!open}>
        {visited && (
          <CandidateWorkshop
            key={projectId}
            projectId={projectId}
            user={user}
            onAdopt={onAdopt}
            onCountChange={onCountChange}
            adoptingId={adoptingId}
          />
        )}
      </div>
    </Card>
  );
}

function CandidateWorkshop({
  projectId,
  user,
  onAdopt,
  onCountChange,
  adoptingId,
}) {
  const guard = useNavigationGuard();
  const editorId = useId();
  const { message } = AntApp.useApp();
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [view, setView] = useState("Board");
  const [selected, setSelected] = useState([]);
  const [combine, setCombine] = useState(null);
  const [combinedText, setCombinedText] = useState("");
  const [groupDraft, setGroupDraft] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [boardStatus, setBoardStatus] = useState("");
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
    Promise.all([loadCandidates(projectId), loadCandidateGroups(projectId)])
      .then(([records, loadedGroups]) => {
        if (active) {
          setItems(records);
          setGroups(loadedGroups);
          setSelected([]);
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
    // Capture/wording remain mounted on refresh; combination sources must not be silently replaced.
    if (combine || groupDraft) {
      guard(() => {
        setLoading(true);
        setRevision((value) => value + 1);
      });
    } else {
      setLoading(true);
      setRevision((value) => value + 1);
    }
  }
  async function saveCombination() {
    if (busy || !combine) return false;
    return perform(async () => {
      const result = await combineCandidates(
        user,
        projectId,
        combine.id,
        combine.items,
        combinedText,
      );
      const sourceIds = combine.items.map((row) => row.id);
      setItems((current) => [
        ...current
          .filter((row) => row.id !== result.id)
          .map((row) =>
            sourceIds.includes(row.id)
              ? { ...row, status: "combined", combinedInto: result.id }
              : row,
          ),
        result,
      ]);
      setCombine(null);
      setCombinedText("");
      setSelected([]);
      setBoardStatus(
        "Combined candidate saved. Original wording and authors are preserved.",
      );
    });
  }
  async function saveGroup() {
    if (busy || !groupDraft) return false;
    return perform(async () => {
      const group = await saveCandidateGroup(
        user,
        projectId,
        groupDraft,
        groupName,
      );
      setGroups((current) => [
        ...current.filter((row) => row.id !== group.id),
        group,
      ]);
      setGroupDraft(null);
      setGroupName("");
      setBoardStatus("Group saved.");
    });
  }
  useDraft("Combined candidate wording", {
    dirty: Boolean(combine),
    busy,
    save: saveCombination,
    discard: () => {
      setCombine(null);
      setCombinedText("");
    },
  });
  useDraft("New candidate group", {
    dirty: Boolean(groupDraft),
    busy,
    save: saveGroup,
    discard: () => {
      setGroupDraft(null);
      setGroupName("");
    },
  });
  const boardDisabled =
    busy ||
    loading ||
    Boolean(error) ||
    editing !== null ||
    Boolean(combine) ||
    Boolean(groupDraft);
  async function move(id, groupId, beforeId = null) {
    if (boardDisabled) return;
    await perform(async () => {
      const item = items.find((row) => row.id === id);
      const order = moveOrder(items, groupId, item, beforeId);
      const saved = await moveCandidate(user, projectId, item, groupId, order);
      const byId = new Map(saved.map((row) => [row.id, row]));
      setItems((current) => current.map((row) => byId.get(row.id) ?? row));
      setBoardStatus("Candidate position saved.");
    });
  }
  const visible = items.filter(
    (item) => showAdopted || item.status === "pending",
  );
  const renderCandidate = (item) => (
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
            <Button disabled={busy || !statement.trim()} onClick={saveWording}>
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
          <Typography.Paragraph>{item.statement}</Typography.Paragraph>
          <CandidateOrigins item={item} items={items} />
          <Typography.Paragraph type="secondary">
            Added by {item.authorEmail || item.createdBy}
            {item.createdAt?.toDate
              ? ` · ${item.createdAt.toDate().toLocaleString()}`
              : " · Just saved"}
          </Typography.Paragraph>
          {item.status !== "pending" ? (
            <>
              <Tag>{item.status === "combined" ? "Combined" : "Adopted"}</Tag>
              <Typography.Text type="secondary">
                {item.status === "combined"
                  ? `Retained as a source of: ${items.find((row) => row.id === item.combinedInto)?.statement ?? "combined candidate"}`
                  : "Active assumption retains this candidate’s origin."}
              </Typography.Text>
            </>
          ) : (
            <Space wrap>
              <Button
                disabled={boardDisabled}
                onClick={() => {
                  setEditing(item.id);
                  setStatement(item.statement);
                }}
              >
                Edit candidate
              </Button>
              <Button
                disabled={boardDisabled || adoptingId === item.id}
                onClick={() =>
                  guard(() =>
                    onAdopt(item, () => {
                      setItems((current) =>
                        current.map((row) =>
                          row.id === item.id
                            ? { ...row, status: "adopted" }
                            : row,
                        ),
                      );
                      setSelected((current) =>
                        current.filter((id) => id !== item.id),
                      );
                      message.success("Adopted with initial scores.");
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
  );
  return (
    <div style={{ marginTop: 16 }}>
      <Space wrap style={{ marginBottom: 16 }}>
        <Segmented
          aria-label="Candidate view"
          options={["Board", "List"]}
          value={view}
          disabled={boardDisabled}
          onChange={setView}
        />
        <Button
          disabled={boardDisabled}
          onClick={() =>
            guard(() => {
              setGroupDraft(newBoardId(projectId, "candidateGroups"));
              setGroupName("");
            })
          }
        >
          Add group
        </Button>
        {view === "Board" && (
          <>
            <Typography.Text>{selected.length} selected</Typography.Text>
            <Button
              disabled={boardDisabled || selected.length < 2}
              onClick={() =>
                guard(() => {
                  setCombine({
                    id: newBoardId(projectId),
                    items: items.filter((row) => selected.includes(row.id)),
                  });
                  setCombinedText("");
                })
              }
            >
              Combine selected
            </Button>
          </>
        )}
      </Space>
      <Typography.Paragraph type="secondary">
        Drag cards to groups or use Move to and Up/Down. Select 2–8 candidates
        to combine. Refresh to see other team members’ changes.
      </Typography.Paragraph>
      <label htmlFor="candidate-entry">
        Candidate assumptions — one per line
      </label>
      <Input.TextArea
        id="candidate-entry"
        rows={4}
        value={text}
        disabled={busy || Boolean(combine) || Boolean(groupDraft)}
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
          disabled={
            loading ||
            Boolean(error) ||
            busy ||
            Boolean(combine) ||
            Boolean(groupDraft) ||
            !text.trim()
          }
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
          {showAdopted ? "Hide completed" : "Show completed"}
        </Button>
      </Space>
      <Typography.Paragraph role="status">{boardStatus}</Typography.Paragraph>
      <Drawer
        title={null}
        aria-labelledby={`${editorId}-combine-title`}
        zIndex={900}
        open={Boolean(combine)}
        size="min(480px, 100vw)"
        onClose={() =>
          guard(() => {
            setCombine(null);
            setCombinedText("");
          })
        }
        extra={
          <Space wrap>
            <Typography.Text strong id={`${editorId}-combine-title`}>
              Combine candidates
            </Typography.Text>
            <Button
              type="primary"
              disabled={busy || !combinedText.trim()}
              onClick={saveCombination}
            >
              Create combined candidate
            </Button>
          </Space>
        }
      >
        <Typography.Paragraph>
          The new candidate replaces the selected cards. Their original wording
          and authors stay available as read-only sources.
        </Typography.Paragraph>
        {combine?.items.map((item) => (
          <div key={item.id} className="candidate-combine-source">
            {item.statement}
            <br />
            <Typography.Text type="secondary">
              {item.authorEmail || item.createdBy}
            </Typography.Text>
          </div>
        ))}
        <label htmlFor="combined-candidate-wording">
          Combined assumption wording
        </label>
        <Input.TextArea
          id="combined-candidate-wording"
          value={combinedText}
          maxLength={2000}
          rows={5}
          disabled={busy}
          onChange={(event) => setCombinedText(event.target.value)}
        />
        {wordingHint(combinedText) && (
          <Alert
            type="info"
            title="Consider stating what must be true. You can still save your wording."
          />
        )}
      </Drawer>
      <Drawer
        title={null}
        aria-labelledby={`${editorId}-group-title`}
        zIndex={900}
        open={Boolean(groupDraft)}
        size="min(400px, 100vw)"
        onClose={() =>
          guard(() => {
            setGroupDraft(null);
            setGroupName("");
          })
        }
        extra={
          <Space wrap>
            <Typography.Text strong id={`${editorId}-group-title`}>
              New candidate group
            </Typography.Text>
            <Button
              type="primary"
              disabled={busy || !groupName.trim()}
              onClick={saveGroup}
            >
              Save group
            </Button>
          </Space>
        }
      >
        <label htmlFor="candidate-group-name">Group name</label>
        <Input
          id="candidate-group-name"
          maxLength={80}
          value={groupName}
          disabled={busy}
          onChange={(event) => setGroupName(event.target.value)}
        />
      </Drawer>
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
            {view === "Board" ? (
              <CandidateBoard
                items={items}
                groups={groups}
                selected={selected}
                onSelect={(id, checked) =>
                  setSelected((current) =>
                    checked
                      ? [...current, id]
                      : current.filter((value) => value !== id),
                  )
                }
                onMove={move}
                disabled={boardDisabled || Boolean(adoptingId)}
                renderCandidate={renderCandidate}
              />
            ) : (
              visible.map((item) => renderCandidate(item))
            )}
            {view === "Board" &&
              showAdopted &&
              items
                .filter((item) => item.status !== "pending")
                .map((item) => renderCandidate(item))}
          </>
        )
      )}
    </div>
  );
}
