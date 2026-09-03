import { useNow } from "./useNow.js";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Space, Spin, Typography } from "antd";
import { acceptInvitation, loadInvitation } from "./memberService.js";

export default function InvitationScreen({
  invitationId,
  user,
  onAccepted,
  onBack,
}) {
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState("");
  const now = useNow();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [acceptedProjectId, setAcceptedProjectId] = useState(null);
  useEffect(() => {
    let active = true;
    loadInvitation(invitationId)
      .then((item) => {
        if (active) setInvitation(item);
      })
      .catch(() => {
        if (active)
          setError(
            "This invitation is unavailable to this account. Check the link and sign in with the invited email address.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [invitationId, attempt]);
  async function accept() {
    setBusy(true);
    setError("");
    let projectId = acceptedProjectId;
    try {
      if (!projectId) {
        projectId = await acceptInvitation(user, invitationId);
        setAcceptedProjectId(projectId);
      }
    } catch (cause) {
      setError(
        cause.code
          ? "The invitation could not be accepted. It may have expired or been revoked; retry or ask the owner for a new link."
          : cause.message,
      );
      setBusy(false);
      return;
    }
    try {
      await onAccepted(projectId);
    } catch {
      setError(
        "Invitation accepted, but the project could not be opened. Retry opening it.",
      );
    } finally {
      setBusy(false);
    }
  }
  const pending = invitation?.status === "pending";
  const expired = invitation && invitation.expiresAt.toMillis() <= now;
  const alreadyAccepted =
    invitation?.status === "accepted" && invitation.acceptedBy === user.uid;
  return (
    <main className="content">
      <Card title="Project invitation">
        <Typography.Paragraph>Signed in as {user.email}.</Typography.Paragraph>
        {loading && <Spin />}
        {error && (
          <Alert
            type="error"
            role="alert"
            title={error}
            action={
              <Button
                onClick={() => {
                  setError("");
                  setLoading(true);
                  setAttempt((value) => value + 1);
                }}
              >
                Reload invitation
              </Button>
            }
          />
        )}
        {invitation && (
          <>
            <Typography.Paragraph>
              {invitation.inviterEmail} invited {invitation.recipientEmail} to
              collaborate. Project details become available after you join.
            </Typography.Paragraph>
            <Typography.Paragraph>
              {pending && expired
                ? "This invitation has expired. Ask the owner for a new link."
                : pending
                  ? `Expires ${invitation.expiresAt.toDate().toLocaleString()}.`
                  : `Invitation ${invitation.status}.`}
            </Typography.Paragraph>
            <Space wrap>
              {((pending && !expired) ||
                alreadyAccepted ||
                acceptedProjectId) && (
                <Button type="primary" loading={busy} onClick={accept}>
                  {alreadyAccepted || acceptedProjectId
                    ? "Open project"
                    : "Accept invitation"}
                </Button>
              )}
            </Space>
          </>
        )}
        <Button disabled={busy} onClick={onBack}>
          Your projects
        </Button>
      </Card>
    </main>
  );
}
