import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import ProjectEntry from "./ProjectEntry.jsx";
import { hasSeenWelcome, rememberWelcome } from "./welcomeService.js";
vi.mock("./welcomeService.js", () => ({
  hasSeenWelcome: vi.fn(),
  rememberWelcome: vi.fn(),
}));
vi.mock("../workspace/ProjectWorkspace.jsx", () => ({
  default: ({ project }) => <p>Workspace: {project.name}</p>,
}));
const project = { id: "p", name: "Pilot project" };
const user = { uid: "owner" };
const entry = (props = {}) => (
  <ProjectEntry project={project} user={user} onBack={vi.fn()} {...props} />
);
beforeEach(() => {
  vi.resetAllMocks();
  hasSeenWelcome.mockResolvedValue(false);
  rememberWelcome.mockResolvedValue();
});
it("welcomes creators and members, then remembers their own project visit", async () => {
  for (const uid of ["owner", "member"]) {
    const { unmount } = render(entry({ user: { uid } }));
    expect(
      await screen.findByRole("heading", { name: "Welcome to Pilot project" }),
    ).toHaveFocus();
    expect(screen.getByText("The Other Side of Innovation")).toBeVisible();
    expect(
      screen.queryByText("Workspace: Pilot project"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start working" }));
    await screen.findByText("Workspace: Pilot project");
    expect(rememberWelcome).toHaveBeenLastCalledWith(uid, "p");
    unmount();
  }
});
it("skips completed welcomes and rechecks when project or person changes", async () => {
  hasSeenWelcome.mockResolvedValueOnce(true);
  const { rerender } = render(entry());
  await screen.findByText("Workspace: Pilot project");
  rerender(entry({ project: { id: "other", name: "Other project" } }));
  await screen.findByRole("heading", { name: "Welcome to Other project" });
  expect(hasSeenWelcome).toHaveBeenLastCalledWith("owner", "other");
  rerender(entry({ user: { uid: "new-member" } }));
  await screen.findByRole("heading", { name: "Welcome to Pilot project" });
  expect(hasSeenWelcome).toHaveBeenLastCalledWith("new-member", "p");
});
it("does not enter the workspace before saving; allows retry after failure", async () => {
  let reject;
  rememberWelcome.mockImplementationOnce(
    () =>
      new Promise((_resolve, no) => {
        reject = no;
      }),
  );
  render(entry());
  fireEvent.click(await screen.findByRole("button", { name: "Start working" }));
  expect(
    screen.queryByText("Workspace: Pilot project"),
  ).not.toBeInTheDocument();
  reject(new Error("offline"));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Start working" }));
  await screen.findByText("Workspace: Pilot project");
  expect(rememberWelcome).toHaveBeenCalledTimes(2);
});
it("keeps onboarding optional when persistence is unavailable", async () => {
  hasSeenWelcome.mockRejectedValueOnce(new Error("offline"));
  render(entry());
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Continue for now" }));
  await screen.findByText("Workspace: Pilot project");
  expect(rememberWelcome).not.toHaveBeenCalled();
});
it("ignores a stale load after switching projects", async () => {
  let resolve;
  hasSeenWelcome.mockImplementationOnce(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  );
  const { rerender } = render(entry());
  rerender(entry({ project: { id: "other", name: "Other project" } }));
  await screen.findByRole("heading", { name: "Welcome to Other project" });
  resolve(true);
  await waitFor(() =>
    expect(
      screen.queryByText("Workspace: Other project"),
    ).not.toBeInTheDocument(),
  );
});

it("lets a person continue while an offline write is pending", async () => {
  rememberWelcome.mockImplementationOnce(() => new Promise(() => {}));
  render(entry());
  fireEvent.click(await screen.findByRole("button", { name: "Start working" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue for now" }));
  await screen.findByText("Workspace: Pilot project");
});
