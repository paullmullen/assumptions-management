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
  Typography,
} from "antd";
import {
  addBasicAssumption,
  loadAssumptions,
  updateAssumption,
} from "../../services.js";

const { Paragraph, Text } = Typography;

export default function AssumptionsPanel({ projectId, user }) {
  const { message } = AntApp.useApp();
  const [assumptions, setAssumptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const [editingAssumptionId, setEditingAssumptionId] = useState(null);
  const [editingStatement, setEditingStatement] = useState("");
  const [editBusy, setEditBusy] = useState(false);

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
    setEditingAssumptionId(assumption.id);
    setEditingStatement(assumption.statement);
  }

  function cancelEditing() {
    setEditingAssumptionId(null);
    setEditingStatement("");
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
            extra="State the assumption affirmatively as something that is true or must become true."
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

              return (
                <div style={{ padding: "12px 0", width: "100%" }}>
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
                    <div
                      style={{
                        alignItems: "start",
                        display: "flex",
                        gap: 16,
                        justifyContent: "space-between",
                      }}
                    >
                      <Paragraph style={{ margin: 0 }}>
                        {assumption.statement}
                      </Paragraph>

                      <Button onClick={() => startEditing(assumption)}>
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              );
            }}
            items={assumptions}
            rowKey="id"
          />
        )}
      </Card>
    </div>
  );
}
