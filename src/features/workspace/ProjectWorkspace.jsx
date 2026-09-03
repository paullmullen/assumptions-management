import { useEffect, useState } from "react";
import { Alert, Button, Card, Layout, Space, Switch, Typography } from "antd";
import AssumptionsPanel from "../assumptions/AssumptionsPanel.jsx";
import ProjectBriefCard from "../projectBrief/ProjectBriefCard.jsx";
import ReviewsPanel from "../reviews/ReviewsPanel.jsx";
import MembersPanel from "../members/MembersPanel.jsx";
import GuidedStart from "../guidedStart/GuidedStart.jsx";
import useWideWorkspace from "./useWideWorkspace.js";
import {
  watchReviewPreference,
  saveReviewPreference,
} from "../reviews/reviewPreference.js";
import { useDraft, useNavigationGuard } from "./draftContext.js";

export default function ProjectWorkspace({ project, user, onBack }) {
  const guard = useNavigationGuard();
  const desktop = useWideWorkspace();
  const [reviewsEnabled, setReviewsEnabled] = useState(null);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [preferenceError, setPreferenceError] = useState("");
  const [preferenceLoadError, setPreferenceLoadError] = useState("");
  const [preferenceAttempt, setPreferenceAttempt] = useState(0);
  useEffect(
    () =>
      watchReviewPreference(
        project.id,
        (enabled) => {
          setReviewsEnabled(enabled);
          setPreferenceLoadError("");
        },
        () => {
          setReviewsEnabled(null);
          setPreferenceLoadError(
            "The review preference could not be loaded. Please retry.",
          );
        },
      ),
    [project.id, preferenceAttempt],
  );
  useDraft("Review preference", { dirty: false, busy: preferenceBusy });
  async function changeReviewPreference(enabled) {
    setPreferenceBusy(true);
    setPreferenceError("");
    try {
      await saveReviewPreference(project.id, user, enabled);
    } catch (error) {
      setPreferenceError(
        error.code === "permission-denied"
          ? "The review preference was not saved: permission denied. Your owner access or the deployed Firestore rules may need updating."
          : "The review preference was not saved. Please check your connection and try again.",
      );
    } finally {
      setPreferenceBusy(false);
    }
  }
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [view, setView] = useState("portfolio");
  const [promisesOpen, setPromisesOpen] = useState(false);
  const [promisesIncomplete, setPromisesIncomplete] = useState(false);
  const [candidateCount, setCandidateCount] = useState(null);
  const [focusTarget, setFocusTarget] = useState(null);
  useEffect(() => {
    if (!focusTarget) return;
    const target = document.getElementById(focusTarget.id);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ block: "start" });
  }, [focusTarget]);
  function navigate(next) {
    if (next === view) return;
    guard(() => {
      setView(next);
      setFocusTarget({
        id: `project-${next === "portfolio" ? "assumptions" : next}`,
      });
    });
  }
  function guideTo(id) {
    guard(() => {
      if (id === "project-promises") setPromisesOpen(true);
      else
        setView(
          id === "project-reviews"
            ? "reviews"
            : id === "project-candidates"
              ? "candidates"
              : "portfolio",
        );
      setFocusTarget({ id });
    });
  }
  return (
    <Layout.Content
      className={`content workspace-content${drawerOpen && desktop ? " workspace-with-drawer" : ""}`}
    >
      <header className="project-context">
        <div>
          <Button type="link" onClick={onBack}>
            All projects
          </Button>
          <Typography.Title level={1}>{project.name}</Typography.Title>
          {project.description && (
            <Typography.Paragraph className="project-description">
              {project.description}
            </Typography.Paragraph>
          )}
        </div>
        <Space wrap>
          <Button
            aria-expanded={promisesOpen}
            aria-controls="project-promises"
            onClick={() => guard(() => setPromisesOpen(!promisesOpen))}
          >
            Three Promises{promisesIncomplete ? " · Incomplete" : ""}
          </Button>
          <Button
            aria-current={view === "settings" ? "page" : undefined}
            onClick={() => navigate("settings")}
          >
            Settings &amp; access
          </Button>
        </Space>
      </header>
      <section
        id="project-promises"
        tabIndex={-1}
        aria-label="Project promises"
        hidden={!promisesOpen}
      >
        <ProjectBriefCard
          projectId={project.id}
          userId={user.uid}
          onIncomplete={setPromisesIncomplete}
        />
      </section>
      {preferenceLoadError && (
        <Alert
          role="alert"
          type="error"
          title={preferenceLoadError}
          action={
            <Button onClick={() => setPreferenceAttempt((value) => value + 1)}>
              Retry preference
            </Button>
          }
        />
      )}
      <nav className="project-navigation" aria-label="Project workspace">
        {[
          ["portfolio", "Portfolio"],
          [
            "candidates",
            `Candidates${candidateCount === null ? "" : ` (${candidateCount})`}`,
          ],
          ["reviews", reviewsEnabled === false ? "Review history" : "Reviews"],
        ].map(([key, label]) => (
          <Button
            key={key}
            type={view === key ? "primary" : "text"}
            aria-current={view === key ? "page" : undefined}
            onClick={() => navigate(key)}
          >
            {label}
          </Button>
        ))}
      </nav>
      <GuidedStart
        reviewsEnabled={reviewsEnabled === true}
        projectId={project.id}
        userId={user.uid}
        onNavigate={guideTo}
      />
      <AssumptionsPanel
        projectId={project.id}
        user={user}
        view={view}
        desktop={desktop}
        onDrawerChange={setDrawerOpen}
        onAdopted={() => {
          setView("portfolio");
          setFocusTarget({ id: "project-assumptions" });
        }}
        onCandidateCount={setCandidateCount}
      />
      {view === "reviews" && (
        <section
          id="project-reviews"
          tabIndex={-1}
          aria-label="Project reviews"
        >
          <ReviewsPanel
            projectId={project.id}
            user={user}
            enabled={reviewsEnabled === true}
          />
        </section>
      )}
      {view === "settings" && (
        <section
          id="project-settings"
          tabIndex={-1}
          aria-label="Project settings and access"
        >
          <Typography.Title level={2}>Settings &amp; access</Typography.Title>
          <Card title="Project information">
            <Typography.Paragraph>{project.name}</Typography.Paragraph>
            <Typography.Paragraph>
              {project.description || "No description"}
            </Typography.Paragraph>
            <Typography.Text type="secondary">
              {project.creatorId === user.uid
                ? "You are the project owner."
                : "You are a project member. The owner manages invitations and access."}
            </Typography.Text>
          </Card>
          <Card title="Formal reviews">
            {preferenceError && (
              <Alert role="alert" type="error" title={preferenceError} />
            )}
            <Typography.Paragraph role="status" aria-live="polite">
              {preferenceBusy
                ? "Saving review preference…"
                : reviewsEnabled === null
                  ? "Review preference unavailable."
                  : `Saved preference: formal reviews ${reviewsEnabled ? "on" : "off"}.`}
            </Typography.Paragraph>
            <Space>
              <Switch
                aria-label="Use formal reviews"
                checked={reviewsEnabled === true}
                loading={preferenceBusy}
                disabled={
                  project.creatorId !== user.uid ||
                  reviewsEnabled === null ||
                  preferenceBusy
                }
                onChange={(enabled) =>
                  guard(() => changeReviewPreference(enabled))
                }
              />
              <Typography.Text>Use formal reviews</Typography.Text>
            </Space>
            <Typography.Paragraph>
              Preserve snapshots of the portfolio and compare changes between
              reviews. Turning this off keeps published reviews and all
              assumption history. Changes save immediately. Only the project
              owner can change this setting.
            </Typography.Paragraph>
          </Card>
          {project.creatorId === user.uid && (
            <MembersPanel projectId={project.id} user={user} />
          )}
        </section>
      )}
    </Layout.Content>
  );
}
