import { useEffect, useState } from "react";
import {
  App as AntApp,
  Button,
  Card,
  Form,
  Input,
  Spin,
  Typography,
} from "antd";
import { loadProjectBrief, saveProjectBrief } from "../../services.js";

const { Paragraph } = Typography;

export default function ProjectBriefCard({ projectId, userId }) {
  return <ProjectBrief key={projectId} projectId={projectId} userId={userId} />;
}

function ProjectBrief({ projectId, userId }) {
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    let active = true;

    loadProjectBrief(projectId)
      .then((brief) => {
        if (active) {
          form.setFieldsValue(brief);
        }
      })
      .catch(() => {
        if (active) {
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
  }, [form, message, projectId]);

  async function submit(values) {
    if (loading || busy) return;
    setBusy(true);

    try {
      await saveProjectBrief(projectId, userId, values);
      message.success("Project promises saved.");
    } catch {
      message.error("The project promises could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ marginBottom: 24 }} title="The three promises">
      <Spin spinning={loading}>
        <Paragraph>
          Describe the promises this project makes to its customer, investor,
          and coworkers. These provide context for identifying the assumptions
          that must be true.
        </Paragraph>

        <Form
          form={form}
          disabled={loading || busy}
          layout="vertical"
          onFinish={submit}
          requiredMark={false}
        >
          <Form.Item
            label="What promise are you making to the customer?"
            name="customerPromise"
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
            rules={[{ max: 4000 }]}
          >
            <Input.TextArea
              maxLength={4000}
              placeholder="Describe the working environment or company culture this project promises."
              rows={3}
            />
          </Form.Item>

          <Button htmlType="submit" loading={busy} type="primary">
            Save promises
          </Button>
        </Form>
      </Spin>
    </Card>
  );
}
