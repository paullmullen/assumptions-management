import { useEffect, useRef, useState } from "react";
import { Button, Card, Select, Space, Typography } from "antd";

import { useNavigationGuard } from "../workspace/draftContext.js";

const steps = [
  {
    title: "Define the three promises",
    text: "Describe the value promised to customers, the business case promised to investors, and the culture promised to coworkers. Investors can include donors, grantmakers, sponsors, or internal funders.",
    example:
      "Ask: What are we promising, and to whom? These promises give the assumptions a shared purpose.",
    target: "project-promises",
    action: "Go to promises",
  },
  {
    title: "Invite your team",
    text: "Invite colleagues to work on this project. Open project access, enter their email address, create an invitation, then copy and share the link. Invitations are not emailed automatically.",
    example:
      "Use the email associated with their sign-in account. You can skip this step and invite people later from Settings & access.",
    target: "project-settings",
    action: "Invite team members",
  },
  {
    title: "Identify what must be true",
    text: "For each promise, ask what is true—or must become true—to deliver it. Start with about 12 important assumptions; this is guidance, not a limit. Use Candidate workshop to collect and refine ideas, then enter both initial scores to adopt them into the portfolio. You can also add an active assumption directly, before scoring it.",
    example:
      "An assumption: “Customers will pay enough to cover delivery costs.” A question (“Will customers pay?”), task (“Interview customers”), risk (“Low demand”), or goal (“Grow revenue”) needs a statement of what must be true.",
    target: "project-candidates",
    action: "Go to candidates",
  },
  {
    title: "Check for blind spots",
    text: "Consider technical feasibility, regulatory requirements, user adoption, quality, commercial and distribution needs, service and support, funding, and team dynamics. Add any important assumptions these reveal, or simply continue.",
    example:
      "This is a prompt for discussion, not proof that the portfolio is complete. You do not need to categorize each assumption.",
    target: "project-candidates",
    action: "Go to candidates",
  },
  {
    title: "Assess and prioritize",
    text: "Select an assumption on the chart or in the list. Score consequence if wrong horizontally, and strength of supporting evidence vertically. The upper-right region combines severe consequences with weak support and usually needs attention first.",
    example:
      "Both scores range from 0 to 100; small differences are not scientific precision. Contrary evidence can reduce support and move a point upward. Changes in consequence are unusual, but mitigation or project changes can justify them.",
    target: "project-assumptions",
    action: "Go to the portfolio",
  },
  {
    title: "Record learning and review",
    text: "Use the selected assumption’s editor to record new insights, next steps, and help needed. Insights can be saved without changing scores. When the team is ready, save a formal review to preserve a snapshot and compare later changes.",
    example:
      "Choose a review rhythm that suits the project—even every two days. Saving a review preserves saved work; it does not save unfinished edits in other forms.",
    target: "project-reviews",
    action: "Go to formal reviews",
  },
];

function readProgress(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    if (
      value &&
      typeof value.open === "boolean" &&
      Number.isInteger(value.step) &&
      value.step >= 0 &&
      value.step < (value.version === 2 ? steps.length : steps.length - 1)
    )
      return {
        ...value,
        step:
          value.version === 2
            ? value.step
            : value.step >= 1
              ? value.step + 1
              : value.step,
      };
  } catch {
    /* Guidance also works when browser storage is unavailable. */
  }
  return { open: false, step: 0 };
}

export default function GuidedStart({
  projectId,
  userId,
  onNavigate,
  reviewsEnabled = true,
  canInvite = false,
  active,
  onActiveChange,
}) {
  return (
    <Guide
      key={`${userId}:${projectId}`}
      active={active}
      onActiveChange={onActiveChange}
      onNavigate={onNavigate}
      canInvite={canInvite}
      reviewsEnabled={reviewsEnabled}
      storageKey={`assumptions-guide:${userId}:${projectId}`}
    />
  );
}

function Guide({
  storageKey,
  onNavigate,
  reviewsEnabled,
  canInvite,
  active,
  onActiveChange,
}) {
  const guard = useNavigationGuard();
  const heading = useRef(null);
  const [progress, setProgress] = useState(() => readProgress(storageKey));
  const open = active ?? progress.open;
  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open, progress.step]);
  const current =
    progress.step === 1 && !canInvite
      ? {
          ...steps[1],
          text: "Only the project owner can invite team members. Ask the owner to create and share an invitation from Settings & access, or continue with setup.",
          action: "View project access",
        }
      : !reviewsEnabled && progress.step === steps.length - 1
        ? {
            title: "Record learning",
            text: "Use the selected assumption’s editor to record new insights, next steps, and help needed. Insights can be saved without changing scores; your history is retained.",
            example:
              "Formal reviews are optional. The project owner can enable snapshots later in Settings & access.",
            target: "project-assumptions",
            action: "Go to the portfolio",
          }
        : steps[progress.step];
  function update(next) {
    guard(() => {
      setProgress(next);
      if (next.open !== open) onActiveChange?.(next.open);
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ ...next, version: 2 }),
        );
      } catch {
        /* Optional preference only. */
      }
    });
  }
  function goToEditor() {
    if (onNavigate) {
      onNavigate(current.target);
      return;
    }
    const target = document.getElementById(current.target);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }
  if (!open)
    return (
      <Button
        className="guided-start-launch"
        onClick={() => update({ ...progress, open: true })}
      >
        Open guided start
      </Button>
    );
  return (
    <Card className="guided-start" id="project-guide" size="small">
      <Space wrap>
        <Typography.Text strong>Guided start</Typography.Text>
        <Button
          aria-expanded={open}
          aria-controls="guided-start-content"
          onClick={() => update({ ...progress, open: !open })}
        >
          {open ? "Pause guidance" : "Open guided start"}
        </Button>
        <Typography.Text type="secondary">
          Optional guidance; edit directly at any time.
        </Typography.Text>
      </Space>
      {open && (
        <div id="guided-start-content">
          <label htmlFor="guide-step">Choose a step</label>
          <Select
            id="guide-step"
            className="guide-step-select"
            value={progress.step}
            options={steps.map((step, index) => ({
              value: index,
              label: `${index + 1}. ${!reviewsEnabled && index === steps.length - 1 ? "Record learning" : step.title}`,
            }))}
            onChange={(step) => update({ open: true, step })}
          />
          <div aria-live="polite" aria-atomic="true">
            <Typography.Title ref={heading} tabIndex={-1} level={2}>
              {progress.step + 1} of {steps.length}: {current.title}
            </Typography.Title>
            <Typography.Paragraph>{current.text}</Typography.Paragraph>
            <Typography.Paragraph type="secondary">
              {current.example}
            </Typography.Paragraph>
          </div>
          <Space wrap>
            <Button type="primary" onClick={goToEditor}>
              {current.action}
            </Button>
            <Button
              disabled={progress.step === 0}
              onClick={() => update({ open: true, step: progress.step - 1 })}
            >
              Previous
            </Button>
            {progress.step === 1 && (
              <Button onClick={() => update({ open: true, step: 2 })}>
                Skip for now
              </Button>
            )}
            {progress.step < steps.length - 1 ? (
              <Button
                onClick={() => update({ open: true, step: progress.step + 1 })}
              >
                Next
              </Button>
            ) : (
              <Button onClick={() => update({ ...progress, open: false })}>
                Finish guidance
              </Button>
            )}
          </Space>
          <Typography.Paragraph
            type="secondary"
            style={{ marginTop: 12, marginBottom: 0 }}
          >
            Your place is remembered on this browser. Open the editor to do the
            work, then return with Open guided start. Next and Finish guidance
            only move the guide; they do not save or mark project work complete.
          </Typography.Paragraph>
        </div>
      )}
    </Card>
  );
}
