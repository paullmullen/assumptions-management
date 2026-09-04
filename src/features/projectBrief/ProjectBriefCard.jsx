import { useEffect, useState } from "react";
import {
  App as AntApp,
  Button,
  Alert,
  Collapse,
  Card,
  Form,
  Input,
  Spin,
  Typography,
} from "antd";
import { useDraft } from "../workspace/draftContext.js";
import { loadProjectBrief, saveProjectBrief } from "../../services.js";

import PromiseHistory from "./PromiseHistory.jsx";
import { promiseLabels } from "./promiseLabels.js";

const { Paragraph } = Typography;

export default function ProjectBriefCard({ projectId, user, onIncomplete }) {
  return (
    <ProjectBrief
      key={projectId}
      projectId={projectId}
      user={user}
      onIncomplete={onIncomplete}
    />
  );
}

function ProjectBrief({ projectId, user, onIncomplete }) {
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const [saved, setSaved] = useState({});
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;

    loadProjectBrief(projectId)
      .then((brief) => {
        if (active) {
          setLoadError(false);
          form.setFieldsValue(brief);
          setSaved(brief);
          onIncomplete?.(
            ["customerPromise", "investorPromise", "coworkerPromise"].some(
              (key) => !brief[key]?.trim(),
            ),
          );
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
          message.error("The project promises could not be loaded.");
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
  }, [form, message, projectId, onIncomplete, loadAttempt]);

  async function submit(values) {
    if (loading || busy || loadError || conflict) return false;
    setBusy(true);

    try {
      await saveProjectBrief(projectId, user, values, saved);
      const normalized = Object.fromEntries(
        Object.keys(promiseLabels).map((key) => [
          key,
          (values[key] ?? "").trim(),
        ]),
      );
      setSaved(normalized);
      form.setFieldsValue(normalized);
      setRevision((value) => value + 1);
      setDirty(false);
      onIncomplete?.(
        ["customerPromise", "investorPromise", "coworkerPromise"].some(
          (key) => !values[key]?.trim(),
        ),
      );
      message.success("Project promises saved.");
      return true;
    } catch (error) {
      if (error.code === "promise-conflict") setConflict(error.current);
      else message.error("The project promises could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  useDraft("Three Promises", {
    dirty,
    busy,
    save: async () => submit(await form.validateFields()),
    discard: () => {
      form.setFieldsValue(saved);
      setDirty(false);
      setConflict(null);
    },
  });
  return (
    <Card style={{ marginBottom: 24 }} title="The three promises">
      {loadError && (
        <Alert
          type="error"
          title="Promises could not be loaded. Editing is disabled until they can be loaded."
          action={
            <Button
              onClick={() => {
                setLoading(true);
                setLoadAttempt((value) => value + 1);
              }}
            >
              Retry promises
            </Button>
          }
        />
      )}
      {conflict && (
        <Alert
          type="warning"
          title="The promises changed while you were editing"
          description={
            <>
              <Paragraph>
                Your draft is retained. Review the latest saved promises below
                before deciding what to keep.
              </Paragraph>
              {Object.entries(promiseLabels).map(([key, label]) => (
                <Paragraph key={key} style={{ whiteSpace: "pre-wrap" }}>
                  <strong>{label} — latest saved:</strong>{" "}
                  {conflict[key] || "Not set"}
                </Paragraph>
              ))}
              <Button
                onClick={() => {
                  setSaved(conflict);
                  setConflict(null);
                }}
              >
                I reviewed these — keep my draft
              </Button>
              <Button
                onClick={() => {
                  form.setFieldsValue(conflict);
                  setSaved(conflict);
                  setDirty(false);
                  setConflict(null);
                  setRevision((value) => value + 1);
                }}
              >
                Use latest saved promises
              </Button>
            </>
          }
        />
      )}
      <Spin spinning={loading}>
        <Paragraph>
          Describe the promises this project makes to its customer, investor,
          and coworkers. These provide context for identifying the assumptions
          that must be true.
        </Paragraph>

        <Form
          form={form}
          disabled={loading || busy || loadError}
          layout="vertical"
          onFinish={submit}
          onValuesChange={(_, values) =>
            setDirty(
              Object.keys(values).some(
                (key) => (values[key] ?? "") !== (saved[key] ?? ""),
              ),
            )
          }
          requiredMark={false}
        >
          <Form.Item
            label="What promise are you making to the customer?"
            name="customerPromise"
            extra="Keep it to one short sentence when possible. Long promises are shortened with an ellipsis in the brief; the full text is saved."
            rules={[{ max: 4000 }]}
          >
            <Input.TextArea
              maxLength={4000}
              placeholder="Describe the value the customer will receive."
              rows={3}
            />
          </Form.Item>

          <Form.Item
            label="What promise are you making to the investor?"
            name="investorPromise"
            extra="Keep it to one short sentence when possible. Long promises are shortened with an ellipsis in the brief; the full text is saved."
            rules={[{ max: 4000 }]}
          >
            <Input.TextArea
              maxLength={4000}
              placeholder="Describe the business case for the person or entity making the project financially possible."
              rows={3}
            />
          </Form.Item>

          <Form.Item
            label="What promise are you making to your coworkers?"
            name="coworkerPromise"
            extra="Keep it to one short sentence when possible. Long promises are shortened with an ellipsis in the brief; the full text is saved."
            rules={[{ max: 4000 }]}
          >
            <Input.TextArea
              maxLength={4000}
              placeholder="Describe the working environment or company culture this project promises."
              rows={3}
            />
          </Form.Item>

          <Button
            htmlType="submit"
            loading={busy}
            disabled={Boolean(conflict)}
            type="primary"
          >
            Save promises
          </Button>
        </Form>
      </Spin>
      <Collapse
        style={{ marginTop: 16 }}
        items={[
          {
            key: "history",
            label: "Promise wording history",
            children: (
              <PromiseHistory projectId={projectId} revision={revision} />
            ),
          },
        ]}
      />
    </Card>
  );
}
