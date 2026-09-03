import { useDraft } from "../workspace/draftContext.js";
import { useNow } from "./useNow.js";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Popconfirm,
  Space,
  Typography,
} from "antd";
import {
  inviteMember,
  loadInvitations,
  loadMembers,
  removeMember,
  revokeInvitation,
} from "./memberService.js";

export default function MembersPanel({ projectId, user }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [error, setError] = useState("");
  const now = useNow();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [form] = Form.useForm();
  const [dirty, setDirty] = useState(false);
  useDraft("Invitation email", {
    dirty,
    busy,
    discard: () => {
      form.resetFields();
      setDirty(false);
    },
  });
  useEffect(() => {
    let active = true;
    Promise.all([loadMembers(projectId), loadInvitations(projectId)])
      .then(([people, invites]) => {
        if (active) {
          setMembers(people);
          setInvitations(invites);
        }
      })
      .catch(() => {
        if (active)
          setError("Project access could not be loaded. Please retry.");
      });
    return () => {
      active = false;
    };
  }, [projectId, attempt]);

  async function change(action, success) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setError(
        cause.code
          ? "The access change could not be saved. Please retry."
          : cause.message,
      );
      setBusy(false);
      return;
    }
    setNotice(success);
    try {
      const [people, invites] = await Promise.all([
        loadMembers(projectId),
        loadInvitations(projectId),
      ]);
      setMembers(people);
      setInvitations(invites);
    } catch {
      setError(
        "The change was saved, but the list could not be refreshed. Please retry loading.",
      );
    } finally {
      setBusy(false);
    }
  }
  const link = (id) => `${window.location.origin}/invitations/${id}`;
  return (
    <Card
      title="Project access"
      extra={
        <Button
          disabled={busy}
          onClick={() => {
            setError("");
            setAttempt((value) => value + 1);
          }}
        >
          Refresh access
        </Button>
      }
      style={{ marginTop: 24 }}
    >
      <Typography.Paragraph>
        Invite someone by email, then copy and share their invitation link. Only
        that verified email account can join. Invitations expire after seven
        days.
      </Typography.Paragraph>
      {error && (
        <Alert
          role="alert"
          type="error"
          title={error}
          action={
            <Button
              onClick={() => {
                setError("");
                setAttempt((value) => value + 1);
              }}
            >
              Retry loading
            </Button>
          }
        />
      )}
      {notice && <Alert role="status" type="success" title={notice} />}
      <Form
        form={form}
        layout="inline"
        onValuesChange={(_, values) => setDirty(Boolean(values.email))}
        onFinish={({ email }) =>
          change(async () => {
            await inviteMember(user, projectId, email);
            form.resetFields();
            setDirty(false);
          }, "Invitation created. Copy its link below and share it with the recipient.")
        }
      >
        <Form.Item
          name="email"
          label="Invite by email"
          rules={[{ required: true, type: "email" }]}
        >
          <Input disabled={busy} maxLength={254} autoComplete="email" />
        </Form.Item>
        <Button htmlType="submit" type="primary" loading={busy}>
          Create invitation
        </Button>
      </Form>
      <Typography.Title level={5}>Active members</Typography.Title>
      <Typography.Paragraph>{user.email} — Owner</Typography.Paragraph>
      {members
        .filter((member) => member.active)
        .map((member) => (
          <div key={member.id}>
            <Space wrap>
              <Typography.Text>{member.email} — Member</Typography.Text>
              <Popconfirm
                title={`Remove access for ${member.email}?`}
                description="Their earlier work and attribution will remain."
                onConfirm={() =>
                  change(
                    () => removeMember(user, projectId, member.userId),
                    "Member access removed.",
                  )
                }
                okText="Remove access"
              >
                <Button danger disabled={busy}>
                  Remove access
                </Button>
              </Popconfirm>
            </Space>
          </div>
        ))}
      <Typography.Title level={5}>Invitations</Typography.Title>
      {!invitations.length && (
        <Typography.Paragraph>No invitations yet.</Typography.Paragraph>
      )}
      {invitations.map((invite) => {
        const pending = invite.status === "pending";
        const expired = invite.expiresAt.toMillis() <= now;
        const superseded = members.some(
          (member) =>
            !member.active &&
            member.email === invite.recipientEmail &&
            member.removedAt?.toMillis() >= invite.createdAt?.toMillis(),
        );
        return (
          <div key={invite.id} style={{ marginBottom: 16 }}>
            <Space wrap>
              <Typography.Text strong>{invite.recipientEmail}</Typography.Text>
              <Typography.Text>
                {pending && superseded
                  ? "Superseded by removal"
                  : pending && expired
                    ? "Expired"
                    : invite.status}
              </Typography.Text>
              {pending && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    change(
                      () => revokeInvitation(invite.id),
                      "Invitation revoked.",
                    )
                  }
                >
                  Revoke
                </Button>
              )}
            </Space>
            {pending && !expired && !superseded && (
              <>
                <Typography.Paragraph type="secondary">
                  Expires {invite.expiresAt.toDate().toLocaleString()}
                </Typography.Paragraph>
                <Typography.Paragraph
                  copyable={{ text: link(invite.id) }}
                  style={{ overflowWrap: "anywhere" }}
                >
                  {link(invite.id)}
                </Typography.Paragraph>
              </>
            )}
          </div>
        );
      })}
    </Card>
  );
}
