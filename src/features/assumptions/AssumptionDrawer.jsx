import { useEffect, useId, useRef, useState } from "react";
import {
  Alert,
  Button,
  Drawer,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Typography,
} from "antd";
import { useDraft, useNavigationGuard } from "../workspace/draftContext.js";
import {
  assumptionFields,
  editableAssumption,
  prepareAssumptionDraft,
} from "./assumptionDraft.js";
import { insightClassifications } from "./insightValues.js";
import { adoptCandidate, saveAssumptionDraft } from "../../services.js";
import CriticalityReminder from "./CriticalityReminder.jsx";
import InsightsPanel from "./InsightsPanel.jsx";

const emptyInsight = {
  description: "",
  sourceUrl: "",
  classification: undefined,
};
export default function AssumptionDrawer({
  projectId,
  user,
  assumption,
  assumptionId,
  candidate,
  number,
  desktop,
  onSaved,
  onClose,
}) {
  const guard = useNavigationGuard();
  const fieldId = useId();
  const heading = useRef(null);
  const errorArea = useRef(null);
  const [baseline, setBaseline] = useState(assumption ?? null);
  const [adopting, setAdopting] = useState(candidate ?? null);
  const [requestId] = useState(() => crypto.randomUUID());
  const [draft, setDraft] = useState(() =>
    editableAssumption(candidate ?? assumption),
  );
  const [candidateConflict, setCandidateConflict] = useState(null);
  const [insight, setInsight] = useState(emptyInsight);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(null);
  const [reverting, setReverting] = useState(false);
  const [newInsights, setNewInsights] = useState([]);
  const original = editableAssumption(adopting ?? baseline ?? {});
  const dirty =
    Object.keys(assumptionFields).some((key) => draft[key] !== original[key]) ||
    Object.values(insight).some(Boolean);
  function validate() {
    if (
      adopting &&
      ![draft.criticality, draft.evidence].every(
        (value) => Number.isInteger(value) && value >= 0 && value <= 100,
      )
    )
      throw new Error(
        "Enter both initial scores as whole numbers from 0–100 before adopting.",
      );
    return prepareAssumptionDraft(baseline, draft, insight);
  }
  let prepared;
  try {
    prepared = validate();
  } catch {
    /* Validation is shown when saving. */
  }
  const canSave =
    !busy &&
    !conflict &&
    !candidateConflict &&
    Boolean(prepared) &&
    (baseline === null ||
      Object.keys(prepared.changes).length > 0 ||
      Boolean(prepared.entry));
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (error || conflict || candidateConflict)
      errorArea.current?.focus({ preventScroll: false });
  }, [error, conflict, candidateConflict]);
  function change(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError("");
  }
  function changeInsight(key, value) {
    setInsight((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError("");
  }
  function discard() {
    setDraft(editableAssumption(adopting ?? baseline ?? {}));
    setInsight(emptyInsight);
    setConflict(null);
    setCandidateConflict(null);
    setError("");
    setSaved(false);
  }
  async function save(event) {
    event?.preventDefault();
    if (inFlight.current || conflict || candidateConflict) return false;
    try {
      validate();
    } catch (cause) {
      setError(cause.message);
      return false;
    }
    inFlight.current = true;
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const result = adopting
        ? {
            assumption: await adoptCandidate(
              user,
              projectId,
              adopting.id,
              adopting.statement,
              draft,
              insight,
              requestId,
            ),
            insight: null,
          }
        : await saveAssumptionDraft(
            user,
            projectId,
            assumptionId,
            baseline,
            draft,
            insight,
          );
      setAdopting(null);
      setBaseline(result.assumption);
      setDraft(editableAssumption(result.assumption));
      setInsight(emptyInsight);
      if (result.insight)
        setNewInsights((current) => [result.insight, ...current]);
      onSaved(result.assumption, true);
      setSaved(true);
      return true;
    } catch (cause) {
      if (cause.code === "candidate-conflict") setCandidateConflict(cause);
      else if (cause.code === "candidate-adopted") setError(cause.message);
      else if (cause.code === "assumption-conflict") setConflict(cause);
      else
        setError(
          cause.code === "permission-denied"
            ? "Access was denied. Your edits are retained. Check your project access before retrying."
            : "Changes could not be saved. Your edits are retained; please try again.",
        );
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  useDraft(
    adopting
      ? "Candidate adoption"
      : baseline
        ? "Assumption changes"
        : "New assumption",
    {
      dirty,
      busy,
      save: () => save(),
      discard,
    },
  );
  const close = () => {
    if (!busy && !reverting) guard(onClose);
  };
  function rebase() {
    const latest = editableAssumption(conflict.current);
    setDraft(
      Object.fromEntries(
        Object.keys(assumptionFields).map((key) => [
          key,
          draft[key] === original[key] ? latest[key] : draft[key],
        ]),
      ),
    );
    setBaseline(conflict.current);
    onSaved(conflict.current);
    setConflict(null);
    setError("");
  }
  return (
    <>
      <Drawer
        open
        placement="right"
        size={desktop ? 520 : "min(560px, 100vw)"}
        rootClassName="assumption-drawer"
        zIndex={900}
        mask={desktop ? false : { closable: false }}
        keyboard={!busy && !reverting}
        autoFocus={false}
        focusable={{ trap: !desktop, focusTriggerAfterClose: false }}
        aria-modal={!desktop}
        aria-labelledby={`${fieldId}-heading`}
        afterOpenChange={(open) => {
          if (open) heading.current?.focus({ preventScroll: true });
        }}
        onClose={close}
        title={
          <span id={`${fieldId}-heading`} ref={heading} tabIndex={-1}>
            {adopting
              ? "Score and adopt candidate"
              : baseline
                ? `Assumption ${number ?? ""}`
                : "New assumption"}
          </span>
        }
        extra={
          <Button aria-label="Close assumption" disabled={busy} onClick={close}>
            Close
          </Button>
        }
        closable={false}
        footer={
          <Space wrap>
            <Button
              type="primary"
              aria-label={adopting ? "Adopt with scores" : "Save changes"}
              onClick={() => save()}
              disabled={!canSave}
              loading={busy}
            >
              {adopting ? "Adopt with scores" : "Save changes"}
            </Button>
            <Button
              disabled={!dirty || busy}
              onClick={() => setReverting(true)}
            >
              Revert changes
            </Button>
            <span role="status">
              {dirty ? "Unsaved changes" : saved ? "Changes saved." : ""}
            </span>
          </Space>
        }
      >
        <form id={fieldId} onSubmit={save} className="assumption-form">
          {adopting && (
            <Alert
              type="info"
              title="Enter both initial scores to adopt this candidate. Nothing is added to the portfolio until you save. To change wording, close this drawer and edit the candidate first."
            />
          )}
          {(error || conflict || candidateConflict) && (
            <div ref={errorArea} tabIndex={-1}>
              {error && <Alert role="alert" type="error" title={error} />}
              {candidateConflict && (
                <Alert
                  role="alert"
                  type="warning"
                  title="The candidate wording changed"
                  description={
                    <>
                      <p>
                        Your scores and notes are retained. Latest wording:{" "}
                        {candidateConflict.current.statement}
                      </p>
                      <Button
                        onClick={() => {
                          setAdopting(candidateConflict.current);
                          setDraft((current) => ({
                            ...current,
                            statement: candidateConflict.current.statement,
                          }));
                          setCandidateConflict(null);
                        }}
                      >
                        Use latest candidate wording
                      </Button>
                      <p>
                        Review your scores against this wording before adopting.
                      </p>
                    </>
                  }
                />
              )}
              {conflict && (
                <Alert
                  type="warning"
                  role="alert"
                  title="Another team member changed this assumption"
                  description={
                    <>
                      <p>
                        Your edits are retained. Review the latest saved values
                        before saving again.
                      </p>
                      <table className="conflict-values">
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th>Latest saved</th>
                            <th>Your draft</th>
                          </tr>
                        </thead>
                        <tbody>
                          {conflict.fields.map((key) => (
                            <tr key={key}>
                              <th>{assumptionFields[key]}</th>
                              <td>
                                {editableAssumption(conflict.current)[key] ??
                                  "Not assessed"}
                              </td>
                              <td>{draft[key] ?? "Not assessed"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <Button onClick={rebase}>
                        Keep my edits against these values
                      </Button>
                      <p>
                        Review the form, then choose Save changes. Revert
                        changes can restore saved values.
                      </p>
                    </>
                  }
                />
              )}
            </div>
          )}
          <section aria-label="Assumption wording">
            <label htmlFor={`${fieldId}-statement`}>Assumption</label>
            <Input.TextArea
              id={`${fieldId}-statement`}
              readOnly={Boolean(adopting)}
              value={draft.statement}
              maxLength={2000}
              autoSize={{ minRows: 3, maxRows: 8 }}
              disabled={busy}
              onChange={(e) => change("statement", e.target.value)}
            />
            <Typography.Paragraph type="secondary">
              State affirmatively what is true—or must become true—to deliver
              the promises.
            </Typography.Paragraph>
          </section>
          <section aria-label="Assessment">
            <Typography.Title level={5}>Assessment</Typography.Title>
            <div className="portfolio-score-fields">
              {[
                ["criticality", "Criticality if wrong"],
                ["evidence", "Strength of supporting evidence"],
              ].map(([key, label]) => (
                <div key={key}>
                  <label htmlFor={`${fieldId}-${key}`}>{label}</label>
                  <InputNumber
                    id={`${fieldId}-${key}`}
                    min={0}
                    max={100}
                    precision={0}
                    value={draft[key]}
                    disabled={busy}
                    onChange={(value) => change(key, value)}
                  />
                </div>
              ))}
            </div>
            <Typography.Paragraph type="secondary">
              Whole numbers from 0–100. The chart shows saved scores.
            </Typography.Paragraph>
            <details>
              <summary>Scoring guidance</summary>
              <Typography.Paragraph>
                <strong>What if we are wrong?</strong>
                <br />
                66–100 — Game over: We cannot deliver our promises.
                <br />
                33–65 — Strategic change required: We can still deliver our
                promises, but we must do it differently.
                <br />
                0–32 — Manageable consequence: We can live with the consequence
                without taking additional action.
              </Typography.Paragraph>
              <Typography.Paragraph>
                <strong>How strong is our evidence?</strong>
                <br />
                0–32 — Educated hypothesis: The assumption is a reasonable,
                informed judgment, but little direct evidence supports it.
                <br />
                33–65 — Indicative evidence: Some relevant evidence exists, but
                it is not yet compelling—for example, small data sets, limited
                testing, or reliance on results produced by others.
                <br />
                66–100 — Strong evidence: Direct, repeatable evidence
                consistently supports the assumption.
              </Typography.Paragraph>
            </details>

            <CriticalityReminder
              original={original.criticality}
              value={draft.criticality}
            />
          </section>
          <section aria-label="New insight">
            <Typography.Title level={5}>New insight</Typography.Title>
            <label htmlFor={`${fieldId}-insight`}>New insight (optional)</label>
            <Input.TextArea
              id={`${fieldId}-insight`}
              rows={3}
              maxLength={4000}
              disabled={busy}
              value={insight.description}
              onChange={(e) => changeInsight("description", e.target.value)}
            />
            <Typography.Paragraph type="secondary">
              Record evidence, revised judgment, or a project change. No score
              change is required.
            </Typography.Paragraph>
            <label htmlFor={`${fieldId}-source`}>Source URL (optional)</label>
            <Input
              id={`${fieldId}-source`}
              maxLength={2000}
              disabled={busy}
              value={insight.sourceUrl}
              onChange={(e) => changeInsight("sourceUrl", e.target.value)}
            />
            <label htmlFor={`${fieldId}-classification`}>
              Why did this assumption change?
            </label>
            <Select
              id={`${fieldId}-classification`}
              allowClear
              disabled={busy}
              value={insight.classification}
              style={{ width: "100%" }}
              options={insightClassifications.map((value) => ({
                value,
                label: value,
              }))}
              onChange={(value) => changeInsight("classification", value)}
            />
          </section>
          <section aria-label="Next steps and help">
            <Typography.Title level={5}>Next steps and help</Typography.Title>
            {["nextStep", "helpNeeded"].map((key) => (
              <div key={key}>
                <label htmlFor={`${fieldId}-${key}`}>
                  {assumptionFields[key]} (optional)
                </label>
                <Input.TextArea
                  id={`${fieldId}-${key}`}
                  rows={2}
                  maxLength={4000}
                  disabled={busy}
                  value={draft[key]}
                  onChange={(e) => change(key, e.target.value)}
                />
              </div>
            ))}
          </section>
          {baseline && (
            <details>
              <summary>History — recorded insights and changes</summary>
              <InsightsPanel
                projectId={projectId}
                assumption={{ ...baseline, id: assumptionId }}
                newInsights={newInsights}
              />
            </details>
          )}
        </form>
      </Drawer>
      <Modal
        title="Revert unsaved changes?"
        open={reverting}
        onCancel={() => setReverting(false)}
        onOk={() => {
          if (conflict) {
            setBaseline(conflict.current);
            setDraft(editableAssumption(conflict.current));
            onSaved(conflict.current);
            setConflict(null);
            setInsight(emptyInsight);
            setError("");
            setSaved(false);
          } else discard();
          setReverting(false);
        }}
        okText="Revert changes"
        cancelText="Keep editing"
        mask={{ closable: false }}
      >
        Restore saved values and clear the unsaved insight?
      </Modal>
    </>
  );
}
