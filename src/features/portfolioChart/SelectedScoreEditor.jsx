import { useEffect, useId, useRef, useState } from "react";
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
} from "antd";
import CriticalityReminder from "../assumptions/CriticalityReminder.jsx";
import {
  insightClassifications,
  normalizeInsight,
} from "../assumptions/insightValues.js";

const { Paragraph, Text } = Typography;
const emptyInsight = {
  description: "",
  sourceUrl: "",
  classification: undefined,
};

export default function SelectedScoreEditor({
  assumption,
  onSave,
  disabled,
  focusRequest = 0,
}) {
  const fieldId = useId();
  const section = useRef(null);
  const scoreInput = useRef(null);
  const [drafts, setDrafts] = useState({});
  const [managementDrafts, setManagementDrafts] = useState({});
  const [insights, setInsights] = useState({});
  const [errors, setErrors] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  useEffect(() => {
    if (focusRequest) {
      section.current?.scrollIntoView?.({ block: "center", behavior: "auto" });
      scoreInput.current?.focus({ preventScroll: true });
    }
  }, [focusRequest]);
  if (!assumption) return null;
  const { id } = assumption;
  const saved = {
    criticality: assumption.criticality ?? null,
    evidence: assumption.evidence ?? null,
  };
  const values = drafts[id] ?? saved;
  const insight = insights[id] ?? emptyInsight;
  const dirty =
    values.criticality !== saved.criticality ||
    values.evidence !== saved.evidence;
  const managementSaved = {
    nextStep: assumption.nextStep ?? "",
    helpNeeded: assumption.helpNeeded ?? "",
  };
  const management = { ...managementSaved, ...managementDrafts[id] };
  const managementChanges = Object.fromEntries(
    Object.entries(management)
      .filter(([key, value]) => value.trim() !== managementSaved[key])
      .map(([key, value]) => [key, value.trim()]),
  );
  const managementDirty = Object.keys(managementChanges).length > 0;
  const hasInsight = Boolean(insight.description.trim());
  const hasInsightDraft = Boolean(
    insight.description || insight.sourceUrl || insight.classification,
  );
  const validScores = Object.values(values).every(
    (value) => Number.isInteger(value) && value >= 0 && value <= 100,
  );
  const busy = disabled || savingId !== null;
  // Unchanged/unassessed scores never gate a standalone insight.
  const canSave =
    (dirty || hasInsight || managementDirty) &&
    (!dirty || validScores) &&
    !busy;

  function change(field, value) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...values, [field]: value },
    }));
    setErrors((current) => ({ ...current, [id]: null }));
    setSavedId(null);
  }
  function changeInsight(field, value) {
    setInsights((current) => ({
      ...current,
      [id]: { ...insight, [field]: value },
    }));
    setErrors((current) => ({ ...current, [id]: null }));
    setSavedId(null);
  }
  function clearDraft(targetId) {
    setManagementDrafts((current) => {
      const next = { ...current };
      delete next[targetId];
      return next;
    });
    setInsights((current) => ({ ...current, [targetId]: emptyInsight }));
    setDrafts((current) => {
      const next = { ...current };
      delete next[targetId];
      return next;
    });
    setErrors((current) => ({ ...current, [targetId]: null }));
  }
  async function save(event) {
    event.preventDefault();
    if (!canSave) return;
    let entry = null;
    try {
      if (hasInsight || insight.sourceUrl.trim() || insight.classification)
        entry = normalizeInsight(insight);
    } catch (error) {
      setErrors((current) => ({ ...current, [id]: error.message }));
      return;
    }
    setSavingId(id);
    setSavedId(null);
    try {
      if (managementDirty)
        await onSave(id, dirty ? values : null, entry, managementChanges);
      else await onSave(id, dirty ? values : null, entry);
      clearDraft(id);
      setSavedId(id);
    } catch (error) {
      const message =
        error.code === "permission-denied"
          ? "Access was denied. Ask the project administrator to check access. Your edits are retained."
          : "Changes could not be saved. Your edits are retained; please try again.";
      setErrors((current) => ({ ...current, [id]: message }));
    } finally {
      setSavingId(null);
    }
  }
  return (
    <section
      ref={section}
      className="portfolio-selection"
      aria-label="Selected assumption editor"
    >
      <Text strong>Selected assumption</Text>
      <Paragraph>{assumption.statement}</Paragraph>
      <form onSubmit={save}>
        <div className="portfolio-score-fields">
          <div>
            <label htmlFor={`${fieldId}-criticality`}>
              Criticality if wrong
            </label>
            <InputNumber
              ref={scoreInput}
              id={`${fieldId}-criticality`}
              min={0}
              max={100}
              precision={0}
              value={values.criticality}
              onChange={(value) => change("criticality", value)}
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-evidence`}>
              Strength of supporting evidence
            </label>
            <InputNumber
              id={`${fieldId}-evidence`}
              min={0}
              max={100}
              precision={0}
              value={values.evidence}
              onChange={(value) => change("evidence", value)}
              disabled={busy}
            />
          </div>
        </div>
        <Paragraph type="secondary">
          Whole numbers from 0–100. Changes take effect when saved.
        </Paragraph>
        <details>
          <summary>Scoring guidance</summary>
          <Paragraph>
            <strong>What if we are wrong?</strong>
            <br />
            66–100 — Game over: We cannot deliver our promises.
            <br />
            33–65 — Strategic change required: We can still deliver our
            promises, but we must do it differently.
            <br />
            0–32 — Manageable consequence: We can live with the consequence
            without taking additional action.
          </Paragraph>
          <Paragraph>
            <strong>How strong is our evidence?</strong>
            <br />
            0–32 — Educated hypothesis: The assumption is a reasonable, informed
            judgment, but little direct evidence supports it.
            <br />
            33–65 — Indicative evidence: Some relevant evidence exists, but it
            is not yet compelling—for example, small data sets, limited testing,
            or reliance on results produced by others.
            <br />
            66–100 — Strong evidence: Direct, repeatable evidence consistently
            supports the assumption.
          </Paragraph>
        </details>
        <CriticalityReminder
          original={saved.criticality}
          value={values.criticality}
        />
        <Space orientation="vertical" style={{ width: "100%" }}>
          {Object.entries({
            nextStep: "Next step",
            helpNeeded: "Help needed",
          }).map(([key, label]) => (
            <div key={key} style={{ width: "100%" }}>
              <label htmlFor={`${fieldId}-${key}`}>{label} (optional)</label>
              <Input.TextArea
                id={`${fieldId}-${key}`}
                value={management[key]}
                maxLength={4000}
                rows={2}
                disabled={busy}
                placeholder={
                  key === "nextStep"
                    ? "What will we do to investigate, validate, or mitigate this assumption?"
                    : "What assistance or resources would help?"
                }
                onChange={(event) => {
                  setManagementDrafts((current) => ({
                    ...current,
                    [id]: { ...current[id], [key]: event.target.value },
                  }));
                  setErrors((current) => ({ ...current, [id]: null }));
                  setSavedId(null);
                }}
              />
            </div>
          ))}
          <label htmlFor={`${fieldId}-insight`}>New insight (optional)</label>
          <Input.TextArea
            id={`${fieldId}-insight`}
            value={insight.description}
            maxLength={4000}
            rows={3}
            disabled={busy}
            onChange={(event) =>
              changeInsight("description", event.target.value)
            }
          />
          <label htmlFor={`${fieldId}-source`}>Source URL (optional)</label>
          <Input
            id={`${fieldId}-source`}
            value={insight.sourceUrl}
            maxLength={2000}
            disabled={busy}
            placeholder="https://"
            onChange={(event) => changeInsight("sourceUrl", event.target.value)}
          />
          <label htmlFor={`${fieldId}-classification`}>
            Classification (optional)
          </label>
          <Select
            id={`${fieldId}-classification`}
            value={insight.classification}
            allowClear
            disabled={busy}
            style={{ width: "100%" }}
            options={insightClassifications.map((value) => ({
              value,
              label: value,
            }))}
            onChange={(value) => changeInsight("classification", value)}
          />
        </Space>
        <Paragraph type="secondary">
          Save changes to scores, next step, help needed, or add an insight.
          Each change records author and date; no score change is required.
        </Paragraph>
        {dirty && !validScores && (
          <Paragraph type="secondary">
            Enter both scores as whole numbers from 0–100, or restore the
            original scores to save only an insight.
          </Paragraph>
        )}
        <Space wrap>
          <Button
            type="primary"
            htmlType="submit"
            aria-label="Save changes"
            disabled={!canSave}
            loading={savingId === id}
          >
            Save changes
          </Button>
          <Button
            disabled={(!dirty && !hasInsightDraft && !managementDirty) || busy}
            onClick={() => {
              clearDraft(id);
              setSavedId(null);
            }}
          >
            Revert changes
          </Button>
          <span role="status">
            {dirty || hasInsightDraft || managementDirty
              ? "Unsaved changes"
              : savedId === id
                ? "Changes saved."
                : ""}
          </span>
        </Space>
        {errors[id] && <Alert type="error" role="alert" title={errors[id]} />}
      </form>
    </section>
  );
}
