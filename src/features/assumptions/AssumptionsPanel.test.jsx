import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { App as AntApp } from "antd";
import { beforeEach, expect, it, vi } from "vitest";
import AssumptionsPanel from "./AssumptionsPanel.jsx";
import DraftProvider from "../workspace/DraftProvider.jsx";
import {
  loadAssumptions,
  loadCandidates,
  loadInsights,
  saveAssumptionDraft,
} from "../../services.js";
vi.mock("../../services.js", () => ({
  loadAssumptions: vi.fn(),
  loadCandidates: vi.fn(),
  loadInsights: vi.fn(),
  saveAssumptionDraft: vi.fn(),
}));
const first = {
  id: "a",
  statement: "Customers will adopt it.",
  criticality: 80,
  evidence: 20,
};
const second = { id: "b", statement: "We can support it." };
const user = { uid: "owner", email: "owner@example.test" };
const point = () => screen.getByRole("button", { name: /^Assumption 1:/ });
const note = () => screen.getByLabelText("New insight (optional)");
const score = () => screen.getByLabelText("Strength of supporting evidence");
const click = (name) =>
  fireEvent.click(
    screen.getByRole("button", { name, exact: typeof name === "string" }),
  );
const type = (input, value) => fireEvent.change(input, { target: { value } });
const app = (projectId = "p", desktop = true) => (
  <AntApp>
    <DraftProvider>
      <AssumptionsPanel projectId={projectId} user={user} desktop={desktop} />
    </DraftProvider>
  </AntApp>
);
async function openFirst() {
  await screen.findByRole("button", { name: /^Assumption 1:/ });
  fireEvent.click(point());
  await screen.findByLabelText("Assumption");
}
function history() {
  fireEvent.click(screen.getByText("History — recorded insights and changes"));
}
beforeEach(() => {
  vi.resetAllMocks();
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  loadAssumptions.mockResolvedValue([first, second]);
  loadCandidates.mockResolvedValue([]);
  loadInsights.mockResolvedValue([]);
  saveAssumptionDraft.mockImplementation(
    async (_user, _project, id, baseline, draft, insight) => ({
      assumption: { ...baseline, ...draft, id },
      insight: insight.description
        ? {
            id: "record",
            description: insight.description,
            authorEmail: user.email,
          }
        : null,
    }),
  );
});
it("opens one immediately editable drawer from chart or list, keeping selection after close", async () => {
  render(app());
  await openFirst();
  expect(screen.getAllByLabelText("Assumption")).toHaveLength(1);
  expect(screen.getAllByLabelText("New insight (optional)")).toHaveLength(1);
  expect(screen.getByRole("dialog", { name: "Assumption 1" })).toHaveAttribute(
    "aria-modal",
    "false",
  );
  expect(screen.getByLabelText("Assumption")).toHaveValue(first.statement);
  expect(score()).toHaveValue("20");
  click("Close assumption");
  await waitFor(() =>
    expect(screen.queryByLabelText("Assumption")).not.toBeInTheDocument(),
  );
  expect(point()).toHaveAttribute("aria-pressed", "true");
  await waitFor(() => expect(point()).toHaveFocus());
  click(/^Open assumption 2:/);
  expect(screen.getByLabelText("Assumption")).toHaveValue(second.statement);
  expect(score()).toHaveValue("");
  expect(
    screen.queryByRole("button", { name: /^Assumption 2:/ }),
  ).not.toBeInTheDocument();
});
it.each([1, 2])(
  "saves insight-only work for assumption %s without requiring scores",
  async (number) => {
    render(app());
    await screen.findByRole("button", { name: /^Open assumption 1:/ });
    click(new RegExp(`^Open assumption ${number}:`));
    type(note(), "New judgment");
    click("Save changes");
    await screen.findByText("Changes saved.");
    expect(saveAssumptionDraft).toHaveBeenCalledWith(
      user,
      "p",
      number === 1 ? "a" : "b",
      number === 1 ? first : second,
      expect.objectContaining({
        criticality: number === 1 ? 80 : null,
        evidence: number === 1 ? 20 : null,
      }),
      expect.objectContaining({ description: "New judgment" }),
    );
    expect(note()).toHaveValue("");
    history();
    expect(
      await screen.findByRole("article", { name: "Recorded insight" }),
    ).toHaveTextContent("New judgment");
  },
);
it("saves wording, scores, next step/help and insight through one action without moving the chart early", async () => {
  render(app());
  await openFirst();
  type(screen.getByLabelText("Assumption"), "Customers will pay for it.");
  type(score(), "60");
  type(note(), "Pilot completed");
  type(screen.getByLabelText("Next step (optional)"), "Expand pilot");
  type(screen.getByLabelText("Help needed (optional)"), "More customers");
  expect(point()).toHaveAttribute(
    "aria-label",
    expect.stringContaining("evidence 20"),
  );
  click("Save changes");
  await screen.findByText("Changes saved.");
  expect(saveAssumptionDraft).toHaveBeenCalledTimes(1);
  expect(saveAssumptionDraft.mock.calls[0][4]).toMatchObject({
    statement: "Customers will pay for it.",
    evidence: 60,
    nextStep: "Expand pilot",
    helpNeeded: "More customers",
  });
  expect(point()).toHaveAttribute(
    "aria-label",
    expect.stringContaining("evidence 60"),
  );
});
it("guards closing a dirty drawer, supports retry, and retains the draft on failure", async () => {
  saveAssumptionDraft.mockRejectedValueOnce(new Error("Offline"));
  render(app());
  await openFirst();
  type(note(), "Keep this");
  click("Close assumption");
  click("Keep editing");
  expect(note()).toHaveValue("Keep this");
  click("Close assumption");
  click("Save and continue");
  await screen.findByText(/Changes were not saved/);
  expect(note()).toHaveValue("Keep this");
  click("Save and continue");
  await waitFor(() =>
    expect(screen.queryByLabelText("Assumption")).not.toBeInTheDocument(),
  );
  expect(saveAssumptionDraft).toHaveBeenCalledTimes(2);
});
it("guards Escape and changing selection; discard never writes", async () => {
  render(app());
  await openFirst();
  type(screen.getByLabelText("Assumption"), "Unfinished wording");
  fireEvent.keyDown(screen.getByLabelText("Assumption"), {
    key: "Escape",
    keyCode: 27,
  });
  await screen.findByText("Discard changes");
  click("Keep editing");
  click(/^Open assumption 2:/);
  click("Discard changes");
  await waitFor(() =>
    expect(screen.getByLabelText("Assumption")).toHaveValue(second.statement),
  );
  expect(saveAssumptionDraft).not.toHaveBeenCalled();
});
it("does not reset a draft when the selected row is clicked again", async () => {
  render(app());
  await openFirst();
  type(note(), "Same item");
  click(/^Open assumption 1:/);
  expect(note()).toHaveValue("Same item");
  expect(
    screen.queryByRole("button", { name: "Discard changes" }),
  ).not.toBeInTheDocument();
});
it("requires an explicit revert and restores scores, wording and the insight", async () => {
  render(app());
  await openFirst();
  type(score(), "55");
  type(screen.getByLabelText("Assumption"), "Draft wording");
  type(note(), "Draft note");
  click("Revert changes");
  click("Keep editing");
  expect(score()).toHaveValue("55");
  click("Revert changes");
  fireEvent.click(
    within(
      screen
        .getByText("Revert unsaved changes?", { selector: ".ant-modal-title" })
        .closest('[role="dialog"]'),
    ).getByRole("button", { name: "Revert changes" }),
  );
  await waitFor(() => expect(score()).toHaveValue("20"));
  expect(note()).toHaveValue("");
  expect(screen.getByLabelText("Assumption")).toHaveValue(first.statement);
});
it("retains incomplete metadata and invalid scores; zero is valid", async () => {
  render(app());
  await screen.findByRole("button", { name: /^Open assumption 2:/ });
  click(/^Open assumption 2:/);
  type(screen.getByLabelText("Source URL (optional)"), "javascript:alert(1)");
  click("Close assumption");
  click("Save and continue");
  await screen.findByText(/Changes were not saved/);
  click("Keep editing");
  type(screen.getByLabelText("Source URL (optional)"), "");
  type(screen.getByLabelText("Criticality if wrong"), "0");
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  type(score(), "0");
  expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
});
it("retains fields on denied writes and history errors can be retried independently", async () => {
  saveAssumptionDraft.mockRejectedValueOnce({ code: "permission-denied" });
  loadInsights.mockRejectedValueOnce({ code: "permission-denied" });
  render(app());
  await openFirst();
  history();
  await screen.findByText(/Access to insights was denied/);
  type(note(), "Keep my finding");
  click("Save changes");
  await screen.findByText(/Access was denied/);
  expect(note()).toHaveValue("Keep my finding");
  click("Retry");
  await screen.findByText("No insights yet.");
  expect(note()).toHaveValue("Keep my finding");
});
it("shows conflict values, retains the draft and requires review before resaving", async () => {
  const current = { ...first, evidence: 45, helpNeeded: "New help" };
  saveAssumptionDraft.mockRejectedValueOnce({
    code: "assumption-conflict",
    current,
    fields: ["evidence"],
  });
  render(app());
  await openFirst();
  type(score(), "60");
  type(note(), "My evidence");
  click("Save changes");
  await screen.findByText("Another team member changed this assumption");
  expect(screen.getByText("45")).toBeInTheDocument();
  expect(note()).toHaveValue("My evidence");
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  click("Keep my edits against these values");
  expect(score()).toHaveValue("60");
  expect(screen.getByLabelText("Help needed (optional)")).toHaveValue(
    "New help",
  );
  expect(saveAssumptionDraft).toHaveBeenCalledTimes(1);
  click("Save changes");
  await screen.findByText("Changes saved.");
  expect(saveAssumptionDraft.mock.calls[1][3]).toEqual(current);
});
it("creates from the same drawer with one save and continues editing the saved assumption", async () => {
  render(app());
  await screen.findByRole("button", { name: /^Open assumption 1:/ });
  click("Add assumption");
  type(screen.getByLabelText("Assumption"), "The new channel can scale.");
  type(screen.getByLabelText("Criticality if wrong"), "80");
  type(score(), "0");
  type(note(), "Initial insight");
  click("Save changes");
  await screen.findByText("Changes saved.");
  expect(saveAssumptionDraft.mock.calls[0][3]).toBeNull();
  expect(
    screen.getByRole("button", { name: /^Open assumption 3:/ }),
  ).toBeInTheDocument();
  type(note(), "Another insight");
  click("Save changes");
  await waitFor(() => expect(saveAssumptionDraft).toHaveBeenCalledTimes(2));
  expect(saveAssumptionDraft.mock.calls[1][3]).toMatchObject({
    statement: "The new channel can scale.",
  });
});
it("prevents duplicate in-flight saves and blocks closing until completion", async () => {
  let resolve;
  saveAssumptionDraft.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  render(app());
  await openFirst();
  type(note(), "Save once");
  click("Save changes");
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Close assumption" }),
  ).toBeDisabled();
  await act(async () => resolve({ assumption: first, insight: null }));
  await screen.findByText("Changes saved.");
  expect(saveAssumptionDraft).toHaveBeenCalledTimes(1);
});
it("renders a modal drawer at narrow widths and clears private drafts on project unmount", async () => {
  const { rerender } = render(app("p", false));
  await openFirst();
  expect(screen.getByRole("dialog", { name: "Assumption 1" })).toHaveAttribute(
    "aria-modal",
    "true",
  );
  type(note(), "Private finding");
  rerender(app("other", false));
  await screen.findByRole("button", { name: /^Open assumption 1:/ });
  expect(screen.queryByLabelText("Assumption")).not.toBeInTheDocument();
  fireEvent.click(point());
  expect(note()).toHaveValue("");
});
it("retains the criticality reminder and existing from/to history", async () => {
  loadInsights.mockResolvedValue([
    {
      id: "old",
      description: "Earlier evidence",
      scoreChange: {
        from: { criticality: 80, evidence: 20 },
        to: { criticality: 80, evidence: 60 },
      },
      authorEmail: user.email,
    },
  ]);
  render(app());
  await openFirst();
  type(score(), "60");
  expect(
    screen.queryByText(/Changes in criticality are unusual/),
  ).not.toBeInTheDocument();
  type(screen.getByLabelText("Criticality if wrong"), "81");
  expect(
    screen.getByText(/Changes in criticality are unusual/),
  ).toBeInTheDocument();
  history();
  expect(await screen.findByText("Evidence: 20 → 60")).toBeInTheDocument();
  expect(
    screen.getByText("Criticality: 80 → 80 (unchanged)"),
  ).toBeInTheDocument();
});

it("sorting keeps chart numbers, selection, and unsaved drawer values", async () => {
  loadAssumptions.mockResolvedValue([
    first,
    { ...second, criticality: 90, evidence: 0 },
  ]);
  render(app());
  await openFirst();
  type(note(), "Keep my draft while sorting");
  type(screen.getByLabelText("Sort assumptions"), "attention");
  const rows = screen.getAllByRole("button", { name: /^Open assumption/ });
  expect(rows[0]).toHaveAccessibleName(/^Open assumption 2:/);
  expect(rows[1]).toHaveAttribute("aria-pressed", "true");
  expect(point()).toHaveAttribute("aria-pressed", "true");
  expect(note()).toHaveValue("Keep my draft while sorting");
  expect(
    screen.getByRole("dialog", { name: "Assumption 1" }),
  ).toBeInTheDocument();
  expect(saveAssumptionDraft).not.toHaveBeenCalled();
});
it("recent sorting includes historical insight-only activity and a new save", async () => {
  loadInsights.mockImplementation(async (_project, id) => [
    {
      id: `old-${id}`,
      createdAt: { toMillis: () => (id === "b" ? 2000 : 1000) },
    },
  ]);
  render(app());
  await openFirst();
  type(screen.getByLabelText("Sort assumptions"), "recent");
  await waitFor(() =>
    expect(
      screen.getAllByRole("button", { name: /^Open assumption/ })[0],
    ).toHaveAccessibleName(/^Open assumption 2:/),
  );
  type(note(), "A new insight without changing scores");
  click("Save changes");
  await screen.findByText("Changes saved.");
  await waitFor(() =>
    expect(
      screen.getAllByRole("button", { name: /^Open assumption/ })[0],
    ).toHaveAccessibleName(/^Open assumption 1:/),
  );
  history();
  expect(screen.getByText("Newest first")).toBeInTheDocument();
});
it("failed recent-history loads show a retry instead of silently incomplete ordering", async () => {
  loadInsights.mockRejectedValue(new Error("Unavailable"));
  render(app());
  await screen.findByRole("button", { name: /^Open assumption 1:/ });
  type(screen.getByLabelText("Sort assumptions"), "recent");
  await screen.findByText(/Recent changes could not be loaded/);
  loadInsights.mockResolvedValue([]);
  click("Retry recent changes");
  await waitFor(() =>
    expect(
      screen.queryByText(/Recent changes could not be loaded/),
    ).not.toBeInTheDocument(),
  );
  await screen.findAllByText("Last change: Date unavailable");
});
