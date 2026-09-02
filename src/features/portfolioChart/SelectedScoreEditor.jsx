import { useId, useState } from "react";
import { Alert, Button, InputNumber, Space, Typography } from "antd";

const { Paragraph, Text } = Typography;

export default function SelectedScoreEditor({ assumption, onSave, disabled }) {
  const fieldId = useId();
  // Keep drafts per assumption while users explore the chart. Project changes
  // unmount this component, so drafts cannot cross the project boundary.
  const [drafts, setDrafts] = useState({});
  const [errors, setErrors] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  if (!assumption) return null;

  const { id } = assumption;
  const saved = {
    criticality: assumption.criticality ?? null,
    evidence: assumption.evidence ?? null,
  };
  const values = drafts[id] ?? saved;
  const dirty =
    values.criticality !== saved.criticality ||
    values.evidence !== saved.evidence;
  const valid = Object.values(values).every(
    (value) => Number.isInteger(value) && value >= 0 && value <= 100,
  );
  const busy = disabled || savingId !== null;

  function change(field, value) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...values, [field]: value },
    }));
    setErrors((current) => ({ ...current, [id]: null }));
    setSavedId(null);
  }

  function clearDraft(targetId) {
    setDrafts((current) => {
      const next = { ...current };
      delete next[targetId];
      return next;
    });
    setErrors((current) => ({ ...current, [targetId]: null }));
  }

  async function save(event) {
    event.preventDefault();
    if (!dirty || !valid || busy) return;
    setSavingId(id);
    setSavedId(null);
    try {
      await onSave(id, values);
      clearDraft(id);
      setSavedId(id);
    } catch {
      setErrors((current) => ({
        ...current,
        [id]: "Scores could not be saved. Your edits are retained; please try again.",
      }));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section
      className="portfolio-selection"
      aria-label="Selected assumption score editor"
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
        <Space wrap>
          <Button
            type="primary"
            htmlType="submit"
            disabled={!dirty || !valid || busy}
            loading={savingId === id}
          >
            Save scores
          </Button>
          <Button
            disabled={!dirty || busy}
            onClick={() => {
              clearDraft(id);
              setSavedId(null);
            }}
          >
            Revert changes
          </Button>
          <span role="status">
            {dirty ? "Unsaved changes" : savedId === id ? "Scores saved." : ""}
          </span>
        </Space>
        {errors[id] && <Alert type="error" role="alert" title={errors[id]} />}
      </form>
    </section>
  );
}
