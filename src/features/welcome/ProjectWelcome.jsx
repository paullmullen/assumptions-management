import { useEffect, useRef } from "react";
import { Button, Typography } from "antd";
import "./welcome.css";

const steps = [
  [
    "Start with the promises",
    "What will this project deliver to customers, investors, and coworkers?",
  ],
  [
    "Identify what must be true",
    "Capture the assumptions behind those promises. Keep the important ones in view.",
  ],
  [
    "Assess each assumption",
    "How serious would it be if we were wrong? How strong is the supporting evidence?",
  ],
  [
    "Focus the learning",
    "Prioritize consequential assumptions with weak evidence. Find practical ways to test them.",
  ],
  [
    "Review and adapt",
    "Record new insights, revise assessments, and decide what to change or which remaining risks to accept.",
  ],
];

export default function ProjectWelcome({
  project,
  onStart,
  busy = false,
  children,
}) {
  const heading = useRef(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className="project-welcome" aria-labelledby="welcome-heading">
      <div className="welcome-introduction">
        <Typography.Text className="welcome-eyebrow">
          A shared starting point
        </Typography.Text>
        <Typography.Title
          ref={heading}
          tabIndex={-1}
          id="welcome-heading"
          level={1}
        >
          Welcome to {project.name}
        </Typography.Title>
        <Typography.Paragraph className="welcome-lead">
          Make the assumptions visible. Learn together. Move forward with
          clarity.
        </Typography.Paragraph>
      </div>
      <div className="welcome-columns">
        <ol className="welcome-steps">
          {steps.map(([title, text], index) => (
            <li key={title}>
              <span className="welcome-step-number" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <Typography.Title level={2}>{title}</Typography.Title>
                <Typography.Paragraph>{text}</Typography.Paragraph>
              </div>
            </li>
          ))}
        </ol>
        <aside className="welcome-source" aria-label="Methodology source">
          <Typography.Text className="welcome-eyebrow">
            The inspiration
          </Typography.Text>
          <Typography.Title level={2}>
            The Other Side of Innovation
          </Typography.Title>
          <Typography.Paragraph>
            Solving the Execution Challenge
          </Typography.Paragraph>
          <Typography.Paragraph className="welcome-authors">
            Vijay Govindarajan &amp; Chris Trimble
            <br />
            Harvard Business Review Press · 2010
          </Typography.Paragraph>
          <Typography.Paragraph>
            This application is inspired by the authors’ approach to testing
            assumptions and learning through innovation.
          </Typography.Paragraph>
          <Typography.Paragraph>
            We have adapted and extended that approach for collaborative
            assumptions management, including the Three Promises structure and
            this app’s workflow.
          </Typography.Paragraph>
        </aside>
      </div>
      {children}
      <footer className="welcome-footer">
        <Button type="primary" size="large" loading={busy} onClick={onStart}>
          Start working
        </Button>
        <Typography.Text type="secondary">
          Revisit this page anytime through About the methodology.
        </Typography.Text>
      </footer>
    </section>
  );
}
