import { useEffect, useState } from "react";
import {
  App as AntApp,
  Button,
  Card,
  Empty,
  Form,
  Input,
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
  saveAssumptionChanges,
} from "../../services.js";
import PortfolioChart from "../portfolioChart/PortfolioChart.jsx";

import CandidatesPanel from "../candidates/CandidatesPanel.jsx";
import InsightsPanel from "./InsightsPanel.jsx";

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
  const [newInsights, setNewInsights] = useState({});
  const [scoreBusy, setScoreBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [editorFocusRequest, setEditorFocusRequest] = useState(0);

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
    setSelectedId(assumption.id);
    setEditingAssumptionId(assumption.id);
    setEditingStatement(assumption.statement);
  }

  function cancelEditing() {
    setEditingAssumptionId(null);
    setEditingStatement("");
  }

  function startScoring(assumption) {
    cancelEditing();
    setSelectedId(assumption.id);
    setEditorFocusRequest((current) => current + 1);
  }

  async function savePortfolioScores(
    assumptionId,
    scores,
    insightValues,
    managementValues,
  ) {
    setScoreBusy(true);
    try {
      const insight = await saveAssumptionChanges(
        user,
        projectId,
        assumptionId,
        scores,
        insightValues,
        ...(managementValues ? [managementValues] : []),
      );
      // A successful commit is final even if refreshing the history later fails.
      if (scores || insight?.managementChange)
        setAssumptions((current) =>
          current.map((item) =>
            item.id === assumptionId
              ? { ...item, ...scores, ...insight?.managementChange?.to }
              : item,
          ),
        );
      if (insight)
        setNewInsights((current) => ({
          ...current,
          [assumptionId]: [insight, ...(current[assumptionId] ?? [])],
        }));
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
      <CandidatesPanel
        projectId={projectId}
        user={user}
        onAdopt={(active) => {
          setAssumptions((current) => [
            ...current.filter((item) => item.id !== active.id),
            active,
          ]);
          setSelectedId(active.id);
        }}
      />
      {assumptions.length > 12 && (
        <Paragraph className="portfolio-size-guidance">
          There are {assumptions.length} active assumptions. About 12 often
          keeps a portfolio manageable; keep more when they are useful.
        </Paragraph>
      )}
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
              const isAssessed =
                Number.isInteger(assumption.criticality) &&
                Number.isInteger(assumption.evidence);

              return (
                <div
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
                        {assumption.sourceCandidateId && (
                          <Tag>Adopted candidate</Tag>
                        )}
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
          editorFocusRequest={editorFocusRequest}
        />
      )}
      {assumptions.some((item) => item.id === selectedId) && (
        <InsightsPanel
          key={selectedId}
          newInsights={newInsights[selectedId]}
          projectId={projectId}
          assumption={assumptions.find((item) => item.id === selectedId)}
        />
      )}
    </div>
  );
}
