import { useEffect, useMemo, useState } from "react";
import {
  App as AntApp,
  Alert,
  Button,
  Card,
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
import ProjectBriefCard from "./features/projectBrief/ProjectBriefCard.jsx";
import { auth, isFirebaseConfigured } from "./firebase.js";
import { authenticationErrorMessage } from "./authErrors.js";
import {
  addBasicAssumption,
  createProject,
  ensureUserProfile,
  loadAssumptions,
  loadProjects,
  updateAssumption,
} from "./services.js";
import {
  refreshVerificationState,
  sendVerificationEmail,
} from "./verification.js";

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

function routeTo(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function AuthScreen() {
  const { message } = AntApp.useApp();
  const [mode, setMode] = useState("sign-in");
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();

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

function ProjectHeader({ projects, projectId, onSelect, onSignOut }) {
  const activeProject = projects.find((project) => project.id === projectId);
  return (
    <Header className="app-header">
      <Space className="header-content" size="middle" wrap>
        <Text className="product-name">Assumptions Management</Text>
        {activeProject && (
          <Text className="active-project">
            Active project: {activeProject.name}
          </Text>
        )}
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

function ProjectScreen({ user, project, onBack }) {
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
    loadAssumptions(project.id)
      .then((items) => active && setAssumptions(items))
      .catch(() => active && message.error("This project is unavailable."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [message, project.id]);

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
      await updateAssumption(user, project.id, assumptionId, statement);
      setAssumptions(await loadAssumptions(project.id));
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
      await addBasicAssumption(user, project.id, values.statement);
      setAssumptions(await loadAssumptions(project.id));
      form.resetFields();
      message.success("Assumption saved.");
    } catch {
      message.error("The assumption could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Content className="content">
      <Button onClick={onBack} type="link">
        All projects
      </Button>
      <Title level={1}>{project.name}</Title>
      {project.description && <Paragraph>{project.description}</Paragraph>}
      <ProjectBriefCard projectId={project.id} userId={user.uid} />
      <div className="two-column">
        <Card title="Add a basic assumption">
          <Paragraph>
            State what is true—or must become true—for this project to deliver
            its promises.
          </Paragraph>
          <Form
            form={form}
            layout="vertical"
            onFinish={submit}
            requiredMark={false}
          >
            <Form.Item
              label="Assumption"
              name="statement"
              rules={[{ required: true, whitespace: true, max: 2000 }]}
              extra="State the assumption affirmatively as something that is true or must become true."
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
          ) : (
            <>
              {assumptions.length === 0 ? (
                <Empty description="No assumptions yet" />
              ) : (
                <Listy
                  itemRender={(assumption) => {
                    const isEditing = editingAssumptionId === assumption.id;

                    return (
                      <div style={{ padding: "12px 0", width: "100%" }}>
                        {isEditing ? (
                          <Space
                            orientation="vertical"
                            style={{ width: "100%" }}
                          >
                            <Input.TextArea
                              autoSize={{ minRows: 2, maxRows: 6 }}
                              maxLength={2000}
                              onChange={(event) =>
                                setEditingStatement(event.target.value)
                              }
                              value={editingStatement}
                            />

                            <Text type="secondary">
                              State the assumption affirmatively as something
                              that is true or must become true.
                            </Text>

                            <Space>
                              <Button
                                loading={editBusy}
                                onClick={() =>
                                  saveAssumptionEdit(assumption.id)
                                }
                                type="primary"
                              >
                                Save
                              </Button>

                              <Button
                                disabled={editBusy}
                                onClick={cancelEditing}
                              >
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
            </>
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
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setProjects([]);
        setProjectsLoading(false);
        setAuthLoading(false);
        return;
      }

      const isVerified = await refreshVerificationState(nextUser);
      const refreshedUser = auth.currentUser;
      setUser(refreshedUser);
      if (isVerified && refreshedUser) {
        setProjectsLoading(true);
        try {
          setProjects(await loadProjects(refreshedUser));
        } catch {
          message.error("Projects could not be loaded.");
        } finally {
          setProjectsLoading(false);
        }
      }
      setAuthLoading(false);
    });
  }, [message]);

  useEffect(() => {
    const updatePath = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", updatePath);
    return () => window.removeEventListener("popstate", updatePath);
  }, []);

  const projectId = useMemo(
    () => pathname.match(/^\/projects\/([^/]+)$/)?.[1],
    [pathname],
  );
  const project = projects.find((item) => item.id === projectId);

  useEffect(() => {
    if (
      !user?.emailVerified ||
      projectsLoading ||
      projectId ||
      projects.length !== 1
    )
      return;
    routeTo(`/projects/${projects[0].id}`);
  }, [user, projectsLoading, projectId, projects]);

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
        onSelect={(id) => routeTo(`/projects/${id}`)}
        onSignOut={() => signOut(auth)}
        projectId={projectId}
        projects={projects}
      />
      {projectsLoading ? (
        <main className="loading-page">
          <Spin size="large" />
        </main>
      ) : project ? (
        <ProjectScreen
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
      <Application />
    </AntApp>
  );
}
