import { useEffect, useRef, useState } from "react";
import {
  App as AntApp,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Listy,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  addBasicAssumption,
  loadAssumptions,
  updateAssumption,
  updateAssumptionScores,
} from "../../services.js";
import PortfolioChart from "../portfolioChart/PortfolioChart.jsx";

const { Paragraph, Text } = Typography;

function criticalityColor(score) {
  if (score >= 66) {
    return "red";
  }

  if (score >= 33) {
    return "gold";
  }

  return "green";
}

function evidenceColor(score) {
  if (score >= 66) {
    return "green";
  }

  if (score >= 33) {
    return "gold";
  }

  return "red";
}

export default function AssumptionsPanel({ projectId, user }) {
  return (
    <ProjectAssumptions key={projectId} projectId={projectId} user={user} />
  );
}

function ProjectAssumptions({ projectId, user }) {
  const { message } = AntApp.useApp();
  const [assumptions, setAssumptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const [editingAssumptionId, setEditingAssumptionId] = useState(null);
  const [editingStatement, setEditingStatement] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [scoringAssumptionId, setScoringAssumptionId] = useState(null);
  const [criticality, setCriticality] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [scoreBusy, setScoreBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const scoreInput = useRef(null);
  const scoringRow = useRef(null);

  useEffect(() => {
    if (scoringAssumptionId) {
      scoringRow.current?.scrollIntoView?.({
        block: "center",
        behavior: "auto",
      });
      scoreInput.current?.focus({ preventScroll: true });
    }
  }, [scoringAssumptionId]);

  useEffect(() => {
    let active = true;

    loadAssumptions(projectId)
      .then((items) => {
        if (active) {
          setAssumptions(items);
        }
      })
      .catch(() => {
        if (active) {
          message.error("This project is unavailable.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [message, projectId]);

  function startEditing(assumption) {
    cancelScoring();
    setSelectedId(assumption.id);
    setEditingAssumptionId(assumption.id);
    setEditingStatement(assumption.statement);
  }

  function cancelEditing() {
    setEditingAssumptionId(null);
    setEditingStatement("");
  }

  function startScoring(assumption) {
    setSelectedId(assumption.id);
    if (scoringAssumptionId === assumption.id) {
      scoringRow.current?.scrollIntoView?.({
        block: "center",
        behavior: "auto",
      });
      scoreInput.current?.focus({ preventScroll: true });
      return;
    }
    cancelEditing();
    setScoringAssumptionId(assumption.id);
    setCriticality(assumption.criticality ?? null);
    setEvidence(assumption.evidence ?? null);
  }

  function cancelScoring() {
    setScoringAssumptionId(null);
    setCriticality(null);
    setEvidence(null);
  }

  async function saveScores(assumptionId) {
    if (!Number.isInteger(criticality) || !Number.isInteger(evidence)) {
      message.warning("Enter both scores as whole numbers from 0 to 100.");
      return;
    }

    setScoreBusy(true);

    try {
      await updateAssumptionScores(user, projectId, assumptionId, {
        criticality,
        evidence,
      });
      setAssumptions(await loadAssumptions(projectId));
      cancelScoring();
      message.success("Assumption scores saved.");
    } catch (error) {
      console.error("Failed to update assumption scores:", error);
      message.error("The assumption scores could not be saved.");
    } finally {
      setScoreBusy(false);
    }
  }

  async function savePortfolioScores(assumptionId, scores) {
    setScoreBusy(true);
    try {
      await updateAssumptionScores(user, projectId, assumptionId, scores);
      setAssumptions(await loadAssumptions(projectId));
      if (scoringAssumptionId === assumptionId) cancelScoring();
    } finally {
      setScoreBusy(false);
    }
  }

  async function saveAssumptionEdit(assumptionId) {
    const statement = editingStatement.trim();

    if (!statement) {
      message.warning("Enter an affirmative assumption statement.");
      return;
    }

    setEditBusy(true);

    try {
      await updateAssumption(user, projectId, assumptionId, statement);
      setAssumptions(await loadAssumptions(projectId));
      cancelEditing();
      message.success("Assumption updated.");
    } catch (error) {
      console.error("Failed to update assumption:", error);
      message.error("The assumption could not be updated.");
    } finally {
      setEditBusy(false);
    }
  }

  async function submit(values) {
    setBusy(true);

    try {
      await addBasicAssumption(user, projectId, values.statement);
      setAssumptions(await loadAssumptions(projectId));
      form.resetFields();
      message.success("Assumption saved.");
    } catch {
      message.error("The assumption could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="two-column">
      <Card title="Add a basic assumption">
        <Paragraph>
          State what is true—or must become true—for this project to deliver its
          promises.
        </Paragraph>

        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          requiredMark={false}
        >
          <Form.Item
            extra="State the assumption affirmatively as something that is true or must become true to deliver the project promises."
            label="Assumption"
            name="statement"
            rules={[{ required: true, whitespace: true, max: 2000 }]}
          >
            <Input.TextArea maxLength={2000} rows={4} />
          </Form.Item>

          <Button htmlType="submit" loading={busy} type="primary">
            Save assumption
          </Button>
        </Form>
      </Card>

      <Card title="Saved assumptions">
        {loading ? (
          <Spin />
        ) : assumptions.length === 0 ? (
          <Empty description="No assumptions yet" />
        ) : (
          <Listy
            itemRender={(assumption) => {
              const isEditing = editingAssumptionId === assumption.id;
              const isScoring = scoringAssumptionId === assumption.id;
              const isAssessed =
                Number.isInteger(assumption.criticality) &&
                Number.isInteger(assumption.evidence);

              return (
                <div
                  ref={isScoring ? scoringRow : null}
                  role="group"
                  aria-label={`Saved assumption: ${assumption.statement}`}
                  className={`saved-assumption${selectedId === assumption.id ? " saved-assumption-selected" : ""}`}
                >
                  <Button
                    type="text"
                    aria-pressed={selectedId === assumption.id}
                    onClick={() => setSelectedId(assumption.id)}
                  >
                    {selectedId === assumption.id
                      ? "Selected assumption"
                      : "Select assumption"}
                  </Button>
                  {isEditing ? (
                    <Space orientation="vertical" style={{ width: "100%" }}>
                      <Input.TextArea
                        autoSize={{ minRows: 2, maxRows: 6 }}
                        maxLength={2000}
                        onChange={(event) =>
                          setEditingStatement(event.target.value)
                        }
                        value={editingStatement}
                      />

                      <Text type="secondary">
                        State the assumption affirmatively as something that is
                        true or must become true.
                      </Text>

                      <Space>
                        <Button
                          loading={editBusy}
                          onClick={() => saveAssumptionEdit(assumption.id)}
                          type="primary"
                        >
                          Save
                        </Button>

                        <Button disabled={editBusy} onClick={cancelEditing}>
                          Cancel
                        </Button>
                      </Space>
                    </Space>
                  ) : isScoring ? (
                    <Space
                      orientation="vertical"
                      size="middle"
                      style={{ width: "100%" }}
                    >
                      <Paragraph style={{ margin: 0 }}>
                        {assumption.statement}
                      </Paragraph>
                      <div>
                        <Text strong>What if we are wrong?</Text>

                        <div style={{ marginTop: 8 }}>
                          <Text>
                            <strong>66–100 — Game over:</strong> We cannot
                            deliver our promises.
                          </Text>
                          <br />

                          <Text>
                            <strong>33–65 — Strategic change required:</strong>{" "}
                            We can still deliver our promises, but we must do it
                            differently.
                          </Text>
                          <br />

                          <Text>
                            <strong>0–32 — Manageable consequence:</strong> We
                            can live with the consequence without taking
                            additional action.
                          </Text>
                        </div>

                        <div style={{ marginTop: 12 }}>
                          <InputNumber
                            ref={scoreInput}
                            aria-label="Criticality score"
                            min={0}
                            max={100}
                            onChange={setCriticality}
                            placeholder="0–100"
                            precision={0}
                            value={criticality}
                          />
                        </div>
                      </div>

                      <div>
                        <Text strong>How strong is our evidence?</Text>

                        <div style={{ marginTop: 8 }}>
                          <Text>
                            <strong>0–32 — Educated hypothesis:</strong> The
                            assumption is a reasonable, informed judgment, but
                            little direct evidence supports it.
                          </Text>
                          <br />

                          <Text>
                            <strong>33–65 — Indicative evidence:</strong> Some
                            relevant evidence exists, but it is not yet
                            compelling—for example, small data sets, limited
                            testing, or reliance on results produced by others.
                          </Text>
                          <br />

                          <Text>
                            <strong>66–100 — Strong evidence:</strong> Direct,
                            repeatable evidence consistently supports the
                            assumption.
                          </Text>
                        </div>

                        <div style={{ marginTop: 12 }}>
                          <InputNumber
                            aria-label="Evidence score"
                            min={0}
                            max={100}
                            onChange={setEvidence}
                            placeholder="0–100"
                            precision={0}
                            value={evidence}
                          />
                        </div>
                      </div>

                      <Space>
                        <Button
                          loading={scoreBusy}
                          onClick={() => saveScores(assumption.id)}
                          type="primary"
                        >
                          Save scores
                        </Button>

                        <Button disabled={scoreBusy} onClick={cancelScoring}>
                          Cancel
                        </Button>
                      </Space>
                    </Space>
                  ) : (
                    <Space
                      orientation="vertical"
                      size="small"
                      style={{ width: "100%" }}
                    >
                      <Paragraph style={{ margin: 0 }}>
                        {assumption.statement}
                      </Paragraph>

                      <Space wrap>
                        {isAssessed ? (
                          <>
                            <Tag
                              color={criticalityColor(assumption.criticality)}
                            >
                              Criticality: {assumption.criticality}
                            </Tag>

                            <Tag color={evidenceColor(assumption.evidence)}>
                              Evidence: {assumption.evidence}
                            </Tag>
                          </>
                        ) : (
                          <Tag>Not assessed</Tag>
                        )}
                      </Space>

                      <Space>
                        <Button
                          disabled={scoreBusy || editBusy}
                          onClick={() => startEditing(assumption)}
                        >
                          Edit statement
                        </Button>

                        <Button
                          disabled={scoreBusy || editBusy}
                          onClick={() => startScoring(assumption)}
                        >
                          {isAssessed ? "Update scores" : "Assess"}
                        </Button>
                      </Space>
                    </Space>
                  )}
                </div>
              );
            }}
            items={assumptions}
            rowKey="id"
          />
        )}
      </Card>

      {!loading && (
        <PortfolioChart
          assumptions={assumptions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onSaveScores={savePortfolioScores}
          editingBusy={scoreBusy || editBusy}
        />
      )}
    </div>
  );
}
