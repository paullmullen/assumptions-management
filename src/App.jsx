import { useEffect, useMemo, useState } from "react";
import {
  App as AntApp,
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  Input,
  Layout,
  Listy,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import ProjectWorkspace from "./features/workspace/ProjectWorkspace.jsx";
import DraftProvider from "./features/workspace/DraftProvider.jsx";
import useProjectNavigation from "./features/workspace/useProjectNavigation.js";
import { useNavigationGuard } from "./features/workspace/draftContext.js";
import InvitationScreen from "./features/members/InvitationScreen.jsx";
import ReviewsPanel from "./features/reviews/ReviewsPanel.jsx";
import ProjectBriefCard from "./features/projectBrief/ProjectBriefCard.jsx";
import GuidedStart from "./features/guidedStart/GuidedStart.jsx";
import AssumptionsPanel from "./features/assumptions/AssumptionsPanel.jsx";
import { auth, isFirebaseConfigured } from "./firebase.js";
import { authenticationErrorMessage } from "./authErrors.js";
import {
  createProject,
  ensureUserProfile,
  loadProjects,
  watchProjects,
} from "./services.js";
import {
  refreshVerificationState,
  sendVerificationEmail,
} from "./verification.js";

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

function AuthScreen() {
  const [mode, setMode] = useState("sign-in");
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const { message } = AntApp.useApp();

  async function submit(values) {
    setBusy(true);
    try {
      if (mode === "sign-up") {
        const credential = await createUserWithEmailAndPassword(
          auth,
          values.email,
          values.password,
        );
        await sendVerificationEmail(credential.user);
        await ensureUserProfile(credential.user);
        message.success(
          "Verification email sent. Verify your email, then sign in.",
        );
        await signOut(auth);
        setMode("sign-in");
      } else if (mode === "reset") {
        await sendPasswordResetEmail(auth, values.email);
        message.success(
          "If an account exists, a password-reset email has been sent.",
        );
        setMode("sign-in");
      } else {
        await signInWithEmailAndPassword(auth, values.email, values.password);
      }
      form.resetFields(["password"]);
    } catch (error) {
      message.error(authenticationErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const copy = {
    "sign-in": ["Sign in", "Use your verified email and password."],
    "sign-up": [
      "Create your account",
      "We will send a verification email before project access is available.",
    ],
    reset: [
      "Reset your password",
      "Enter your email and we will send reset instructions if an account exists.",
    ],
  }[mode];

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <Title level={2}>Assumptions Management</Title>
        <Paragraph>{copy[1]}</Paragraph>
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          requiredMark={false}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, type: "email" }]}
          >
            <Input autoComplete="email" />
          </Form.Item>
          {mode !== "reset" && (
            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, min: 8 }]}
            >
              <Input.Password
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
              />
            </Form.Item>
          )}
          <Button block htmlType="submit" loading={busy} type="primary">
            {copy[0]}
          </Button>
        </Form>
        <Space className="auth-links" wrap>
          {mode !== "sign-in" && (
            <Button type="link" onClick={() => setMode("sign-in")}>
              Sign in
            </Button>
          )}
          {mode !== "sign-up" && (
            <Button type="link" onClick={() => setMode("sign-up")}>
              Create account
            </Button>
          )}
          {mode !== "reset" && (
            <Button type="link" onClick={() => setMode("reset")}>
              Forgot password?
            </Button>
          )}
        </Space>
      </Card>
    </main>
  );
}

function VerificationScreen({ user }) {
  const { message } = AntApp.useApp();
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    try {
      await sendVerificationEmail(user);
      message.success("A new verification email has been sent.");
    } catch (error) {
      message.error(authenticationErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <Title level={2}>Verify your email</Title>
        <Paragraph>
          Check your inbox for the Firebase verification link, then sign in
          again. If it has not arrived, request another email below.
        </Paragraph>
        <Space wrap>
          <Button loading={busy} onClick={resend} type="primary">
            Resend verification email
          </Button>
          <Button onClick={() => signOut(auth)}>Sign out</Button>
        </Space>
      </Card>
    </main>
  );
}

function ProjectHeader({ projects, projectId, onSelect, onCreate, onSignOut }) {
  return (
    <Header className="app-header">
      <Space className="header-content" size="middle" wrap>
        <Text className="product-name">Assumptions Management</Text>
        <Select
          aria-label="Project switcher"
          className="project-switcher"
          onChange={onSelect}
          options={projects.map((project) => ({
            value: project.id,
            label: project.name,
          }))}
          placeholder="Select a project"
          value={projectId}
        />
        <Button onClick={onCreate}>Create project</Button>
        <Button onClick={onSignOut}>Sign out</Button>
      </Space>
    </Header>
  );
}

function ProjectSelector({ projects, onOpen, onCreate }) {
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  async function submit(values) {
    setBusy(true);
    try {
      await onCreate(values);
      form.resetFields();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Content className="content">
      <Title level={1}>Your projects</Title>
      <Paragraph>
        Create a private project or open one you already belong to.
      </Paragraph>
      <div className="two-column">
        <Card title="Create a project">
          <Form
            form={form}
            layout="vertical"
            onFinish={submit}
            requiredMark={false}
            initialValues={{ formalReviewsEnabled: false }}
          >
            <Form.Item
              label="Project name"
              name="name"
              rules={[{ required: true, whitespace: true, max: 120 }]}
            >
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item
              label="Description (optional)"
              name="description"
              rules={[{ max: 1000 }]}
            >
              <Input.TextArea maxLength={1000} rows={3} />
            </Form.Item>
            <Form.Item
              name="formalReviewsEnabled"
              valuePropName="checked"
              extra="Preserve review snapshots and compare changes. The owner can change this later in Settings & access."
            >
              <Checkbox>Use formal reviews</Checkbox>
            </Form.Item>
            <Button htmlType="submit" loading={busy} type="primary">
              Create private project
            </Button>
          </Form>
        </Card>
        <Card title="Authorized projects">
          {projects.length === 0 ? (
            <Empty description="No projects yet" />
          ) : (
            <Listy
              itemRender={(project) => (
                <div
                  style={{
                    alignItems: "center",
                    display: "flex",
                    gap: 16,
                    justifyContent: "space-between",
                    padding: "12px 0",
                  }}
                >
                  <div>
                    <Text strong>{project.name}</Text>
                    <br />
                    <Text type="secondary">
                      {project.description || "No description"}
                    </Text>
                  </div>

                  <Button onClick={() => onOpen(project.id)}>Open</Button>
                </div>
              )}
              items={projects}
              rowKey="id"
            />
          )}
        </Card>
      </div>
    </Content>
  );
}

function Application() {
  const { message } = AntApp.useApp();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [pathname, routeTo] = useProjectNavigation();
  const guard = useNavigationGuard();

  useEffect(() => {
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      const current = ++generation;
      setProjects([]);
      if (!nextUser) {
        setUser(null);
        setProjects([]);
        setProjectsLoading(false);
        setAuthLoading(false);
        return;
      }

      const isVerified = await refreshVerificationState(nextUser);
      if (current !== generation) return;
      const refreshedUser = auth.currentUser;
      setUser(refreshedUser);
      setProjectsLoading(Boolean(isVerified && refreshedUser));
      if (current === generation) setAuthLoading(false);
    });
    return () => {
      generation += 1;
      unsubscribe();
    };
  }, [message]);

  useEffect(() => {
    if (!user?.emailVerified) return;
    return watchProjects(
      user,
      (items) => {
        setProjects(items);
        setProjectsLoading(false);
      },
      () => {
        setProjects([]);
        setProjectsLoading(false);
        message.error(
          "Project access could not be refreshed. Please sign in again.",
        );
      },
    );
  }, [user, message]);

  const isCreatingProject = pathname === "/projects/new";
  const invitationId = pathname.match(/^\/invitations\/([^/]+)$/)?.[1];

  const projectId = useMemo(() => {
    if (pathname === "/projects/new") {
      return undefined;
    }

    return pathname.match(/^\/projects\/([^/]+)$/)?.[1];
  }, [pathname]);

  const project = projects.find((item) => item.id === projectId);

  useEffect(() => {
    if (
      !user?.emailVerified ||
      projectsLoading ||
      isCreatingProject ||
      invitationId ||
      projectId ||
      projects.length !== 1
    ) {
      return;
    }

    routeTo(`/projects/${projects[0].id}`);
  }, [
    user,
    projectsLoading,
    isCreatingProject,
    invitationId,
    projectId,
    projects,
    routeTo,
  ]);

  async function createAndOpen(values) {
    try {
      const id = await createProject(user, values);
      const items = await loadProjects(user);
      setProjects(items);
      routeTo(`/projects/${id}`);
    } catch {
      message.error("The project could not be created.");
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <Alert
        message="Firebase configuration is missing"
        description="Copy .env.example to .env.local and add the development web-app configuration."
        showIcon
        type="error"
      />
    );
  }
  if (authLoading)
    return (
      <main className="loading-page">
        <Spin size="large" />
      </main>
    );
  if (!user) return <AuthScreen />;
  if (!user.emailVerified) return <VerificationScreen user={user} />;

  return (
    <Layout className="app-layout">
      <ProjectHeader
        onCreate={() => routeTo("/projects/new")}
        onSelect={(id) => routeTo(`/projects/${id}`)}
        onSignOut={() => guard(() => signOut(auth))}
        projectId={projectId}
        projects={projects}
      />
      {projectsLoading ? (
        <main className="loading-page">
          <Spin size="large" />
        </main>
      ) : invitationId ? (
        <InvitationScreen
          key={`${user.uid}:${invitationId}`}
          invitationId={invitationId}
          user={user}
          onBack={() => routeTo("/projects")}
          onAccepted={async (id) => {
            const items = await loadProjects(user);
            if (!items.some((item) => item.id === id))
              throw new Error("Project unavailable.");
            setProjects(items);
            routeTo(`/projects/${id}`);
          }}
        />
      ) : project ? (
        <ProjectWorkspace
          key={`${user.uid}:${project.id}`}
          onBack={() => routeTo("/projects")}
          project={project}
          user={user}
        />
      ) : (
        <ProjectSelector
          onCreate={createAndOpen}
          onOpen={(id) => routeTo(`/projects/${id}`)}
          projects={projects}
        />
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <AntApp>
      <DraftProvider>
        <Application />
      </DraftProvider>
    </AntApp>
  );
}
