import { useEffect, useState } from "react";
import { Alert, Button, Layout, Spin } from "antd";
import ProjectWorkspace from "../workspace/ProjectWorkspace.jsx";
import ProjectWelcome from "./ProjectWelcome.jsx";
import { hasSeenWelcome, rememberWelcome } from "./welcomeService.js";

export default function ProjectEntry(props) {
  // Reset the entry check whenever either identity changes, including in tests.
  return <Entry key={`${props.user.uid}:${props.project.id}`} {...props} />;
}
function Entry({ project, user, onBack }) {
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    hasSeenWelcome(user.uid, project.id).then(
      (seen) => {
        if (active) setStatus(seen ? "ready" : "welcome");
      },
      () => {
        if (!active) return;
        setStatus("welcome");
        setError(
          "We couldn’t check whether you’ve seen this page. You can still start working.",
        );
      },
    );
    return () => {
      active = false;
    };
  }, [user.uid, project.id]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      await rememberWelcome(user.uid, project.id);
      setStatus("ready");
    } catch {
      setError(
        "We couldn’t remember your visit. Try again, or continue for now; this page may appear next time.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (status === "ready")
    return <ProjectWorkspace project={project} user={user} onBack={onBack} />;
  return (
    <Layout.Content className="content welcome-entry">
      <Button type="link" onClick={onBack}>
        All projects
      </Button>
      {status === "loading" ? (
        <div role="status" aria-label="Loading project welcome">
          <Spin />
        </div>
      ) : (
        <ProjectWelcome project={project} busy={busy} onStart={start}>
          {busy && (
            <Button onClick={() => setStatus("ready")}>Continue for now</Button>
          )}
          {error && (
            <Alert
              role="alert"
              type="warning"
              title={error}
              action={
                <Button disabled={busy} onClick={() => setStatus("ready")}>
                  Continue for now
                </Button>
              }
            />
          )}
        </ProjectWelcome>
      )}
    </Layout.Content>
  );
}
