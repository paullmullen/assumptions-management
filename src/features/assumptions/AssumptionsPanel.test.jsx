import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { App as AntApp } from "antd";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import AssumptionsPanel from "./AssumptionsPanel.jsx";
import {
  loadAssumptions,
  loadInsights,
  saveAssumptionChanges,
} from "../../services.js";

vi.mock("../../services.js", () => ({
  loadAssumptions: vi.fn(),
  saveAssumptionChanges: vi.fn(),
  loadInsights: vi.fn(),
  updateAssumption: vi.fn(),
  addBasicAssumption: vi.fn(),
}));
const first = {
  id: "a",
  statement: "Customers will adopt it.",
  criticality: 80,
  evidence: 20,
};
const second = {
  id: "b",
  statement: "We can deliver it.",
  criticality: 40,
  evidence: 70,
};
const unassessed = { id: "c", statement: "We can support it." };
const user = { uid: "owner", email: "owner@example.com" };

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});
beforeEach(() => {
  vi.resetAllMocks();
  loadAssumptions.mockResolvedValue([first, second, unassessed]);
  loadInsights.mockResolvedValue([]);
  saveAssumptionChanges.mockResolvedValue(null);
});
function app(projectId = "project-a") {
  return (
    <AntApp>
      <AssumptionsPanel projectId={projectId} user={user} />
    </AntApp>
  );
}
const row = (statement = first.statement) =>
  screen.findByRole("group", { name: `Saved assumption: ${statement}` });
const point = (number = 1) =>
  screen.getByRole("button", { name: new RegExp(`^Assumption ${number}:`) });
const note = () => screen.getByLabelText("New insight (optional)");
const save = () => screen.getByRole("button", { name: "Save changes" });
const criticality = () =>
  screen.getByRole("spinbutton", { name: "Criticality if wrong" });
const evidence = () =>
  screen.getByRole("spinbutton", { name: "Strength of supporting evidence" });
const type = (input, value) => fireEvent.change(input, { target: { value } });
async function selectFirst() {
  await row();
  fireEvent.click(point());
}

describe("single assumption editor", () => {
  it("shares selection with the chart and list, with one insight entry and Save action", async () => {
    render(app());
    const item = await row();
    fireEvent.keyDown(point(), { key: "Enter" });
    expect(item).toHaveClass("saved-assumption-selected");
    expect(screen.getAllByLabelText("New insight (optional)")).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: "Save changes" }),
    ).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Add insight" }),
    ).not.toBeInTheDocument();
    expect(save()).toBeDisabled();
    fireEvent.click(
      within(item).getByRole("button", { name: "Update scores" }),
    );
    expect(screen.getAllByLabelText("New insight (optional)")).toHaveLength(1);
    expect(criticality()).toHaveFocus();
    fireEvent.click(
      within(await row(second.statement)).getByRole("button", {
        name: "Select assumption",
      }),
    );
    expect(point(2)).toHaveAttribute("aria-pressed", "true");
    expect(criticality()).toHaveValue("40");
  });
  it.each([first, unassessed])(
    "saves an insight alone for $id without sending scores",
    async (assumption) => {
      const entry = {
        id: "i",
        description: "New judgment without score movement",
        authorEmail: user.email,
        createdAt: null,
      };
      saveAssumptionChanges.mockResolvedValue(entry);
      render(app());
      const item = await row(assumption.statement);
      fireEvent.click(
        within(item).getByRole("button", { name: "Select assumption" }),
      );
      expect(save()).toBeDisabled();
      type(note(), entry.description);
      expect(save()).toBeEnabled();
      fireEvent.click(save());
      await screen.findByText("Changes saved.");
      expect(saveAssumptionChanges).toHaveBeenCalledWith(
        user,
        "project-a",
        assumption.id,
        null,
        { description: entry.description },
      );
      expect(note()).toHaveValue("");
      expect(criticality()).toHaveValue(
        assumption.criticality?.toString() ?? "",
      );
      expect(evidence()).toHaveValue(assumption.evidence?.toString() ?? "");
      expect(
        await screen.findByRole("article", { name: "Recorded insight" }),
      ).toHaveTextContent(entry.description);
      expect(save()).toBeDisabled();
    },
  );
  it.each(["criticality", "evidence"])(
    "saves %s and an insight through the same action",
    async (axis) => {
      render(app());
      await selectFirst();
      type(axis === "criticality" ? criticality() : evidence(), "55");
      type(note(), "We learned something");
      type(
        screen.getByLabelText("Source URL (optional)"),
        "https://example.com/report",
      );
      fireEvent.click(save());
      await screen.findByText("Changes saved.");
      expect(saveAssumptionChanges).toHaveBeenCalledWith(
        user,
        "project-a",
        "a",
        { criticality: 80, evidence: 20, [axis]: 55 },
        {
          description: "We learned something",
          sourceUrl: "https://example.com/report",
        },
      );
      expect(point()).toHaveAttribute(
        "aria-label",
        expect.stringContaining(
          axis === "criticality" ? "Criticality 55" : "evidence 55",
        ),
      );
    },
  );
  it("saves scores without requiring an insight and shows the reminder only for criticality", async () => {
    render(app());
    await selectFirst();
    type(evidence(), "60");
    expect(
      screen.queryByText(/Changes in criticality are unusual/),
    ).not.toBeInTheDocument();
    fireEvent.click(save());
    await screen.findByText("Changes saved.");
    expect(saveAssumptionChanges).toHaveBeenLastCalledWith(
      user,
      "project-a",
      "a",
      { criticality: 80, evidence: 60 },
      null,
    );
    type(criticality(), "81");
    expect(
      screen.getByText(/Changes in criticality are unusual/),
    ).toBeInTheDocument();
    expect(save()).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Revert changes" }));
    expect(
      screen.queryByText(/Changes in criticality are unusual/),
    ).not.toBeInTheDocument();
  });
  it("retains score and insight drafts on failure and across selections; revert clears both", async () => {
    saveAssumptionChanges.mockRejectedValueOnce(new Error("Unavailable"));
    render(app());
    await selectFirst();
    type(evidence(), "55");
    type(note(), "Retain this");
    fireEvent.click(save());
    await screen.findByText(/Your edits are retained/);
    fireEvent.click(point(2));
    expect(note()).toHaveValue("");
    fireEvent.click(point());
    expect(note()).toHaveValue("Retain this");
    expect(evidence()).toHaveValue("55");
    expect(point()).toHaveAttribute(
      "aria-label",
      expect.stringContaining("evidence 20"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Revert changes" }));
    expect(note()).toHaveValue("");
    expect(evidence()).toHaveValue("20");
  });
  it("supports standalone insights even when history loading is denied, and offers retry", async () => {
    loadInsights.mockRejectedValueOnce({ code: "permission-denied" });
    render(app());
    await selectFirst();
    await screen.findByText(/Access to insights was denied/);
    type(note(), "My draft");
    expect(save()).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("No insights yet.");
    expect(note()).toHaveValue("My draft");
  });
  it("retains a note-only draft when its save is denied", async () => {
    saveAssumptionChanges.mockRejectedValueOnce({ code: "permission-denied" });
    render(app());
    await selectFirst();
    type(note(), "Do not lose this");
    fireEvent.click(save());
    await screen.findByText(/Access was denied/);
    expect(note()).toHaveValue("Do not lose this");
    expect(save()).toBeEnabled();
  });
  it("does not require scoring unassessed assumptions and keeps them off the chart", async () => {
    render(app());
    const item = await row(unassessed.statement);
    fireEvent.click(within(item).getByRole("button", { name: "Assess" }));
    expect(criticality()).toHaveValue("");
    expect(evidence()).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: /^Assumption 3:/ }),
    ).not.toBeInTheDocument();
    type(note(), "Learning first");
    expect(save()).toBeEnabled();
    type(criticality(), "70");
    expect(save()).toBeDisabled();
    type(evidence(), "30");
    expect(save()).toBeEnabled();
    expect(
      screen.queryByText(/Changes in criticality are unusual/),
    ).not.toBeInTheDocument();
  });
  it("rejects invalid source URLs and whitespace-only insights", async () => {
    render(app());
    await selectFirst();
    type(note(), "   ");
    expect(save()).toBeDisabled();
    type(note(), "A note");
    type(screen.getByLabelText("Source URL (optional)"), "javascript:alert(1)");
    fireEvent.click(save());
    await screen.findByText("Enter an http:// or https:// source URL.");
    expect(saveAssumptionChanges).not.toHaveBeenCalled();
  });
  it("does not re-enable Save until an in-flight operation finishes", async () => {
    let resolve;
    saveAssumptionChanges.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    render(app());
    await selectFirst();
    type(note(), "Save once");
    fireEvent.click(save());
    expect(save()).toBeDisabled();
    await act(async () => resolve(null));
    await screen.findByText("Changes saved.");
    expect(saveAssumptionChanges).toHaveBeenCalledTimes(1);
  });
  it("does not show a late history response under another assumption", async () => {
    let resolve;
    loadInsights.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    render(app());
    await selectFirst();
    fireEvent.click(point(2));
    await screen.findByText("No insights yet.");
    await act(async () =>
      resolve([{ id: "old", description: "Wrong assumption" }]),
    );
    expect(screen.queryByText("Wrong assumption")).not.toBeInTheDocument();
  });
  it("clears editor drafts and recorded insights on project switch", async () => {
    const { rerender } = render(app());
    await selectFirst();
    type(note(), "Project A only");
    rerender(app("project-b"));
    await row();
    expect(
      screen.queryByLabelText("New insight (optional)"),
    ).not.toBeInTheDocument();
    fireEvent.click(point());
    expect(note()).toHaveValue("");
    await waitFor(() =>
      expect(loadInsights).toHaveBeenLastCalledWith("project-b", "a"),
    );
  });
});

it("displays from/to scores alongside notes and supports old insight records", async () => {
  loadInsights.mockResolvedValue([
    {
      id: "change",
      description: "More compelling evidence",
      authorEmail: user.email,
      scoreChange: {
        from: { criticality: 80, evidence: 20 },
        to: { criticality: 80, evidence: 60 },
      },
    },
    {
      id: "initial",
      scoreChange: {
        from: { criticality: null, evidence: null },
        to: { criticality: 70, evidence: 30 },
      },
      authorEmail: user.email,
    },
    {
      id: "legacy",
      description: "An earlier insight",
      authorEmail: user.email,
    },
  ]);
  render(app());
  await selectFirst();
  expect(await screen.findByText("Evidence: 20 → 60")).toBeInTheDocument();
  expect(
    screen.getByText("Criticality: 80 → 80 (unchanged)"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Criticality: Not assessed → 70"),
  ).toBeInTheDocument();
  expect(screen.getByText("More compelling evidence")).toBeInTheDocument();
  expect(screen.getByText("An earlier insight")).toBeInTheDocument();
});

it("saves next step and help needed without requiring scores or an insight", async () => {
  saveAssumptionChanges.mockResolvedValue({
    id: "management",
    createdBy: user.uid,
    authorEmail: user.email,
    managementChange: {
      from: { nextStep: "", helpNeeded: "" },
      to: { nextStep: "Run a pilot", helpNeeded: "Two customers" },
    },
  });
  render(app());
  const item = await row(unassessed.statement);
  fireEvent.click(
    within(item).getByRole("button", { name: "Select assumption" }),
  );
  type(screen.getByLabelText("Next step (optional)"), "Run a pilot");
  type(screen.getByLabelText("Help needed (optional)"), "Two customers");
  expect(save()).toBeEnabled();
  fireEvent.click(save());
  await screen.findByText("Changes saved.");
  expect(saveAssumptionChanges).toHaveBeenCalledWith(
    user,
    "project-a",
    "c",
    null,
    null,
    { nextStep: "Run a pilot", helpNeeded: "Two customers" },
  );
  expect(screen.getByLabelText("Next step (optional)")).toHaveValue(
    "Run a pilot",
  );
  expect(screen.getByText("Now: Run a pilot")).toBeInTheDocument();
  expect(criticality()).toHaveValue("");
  expect(evidence()).toHaveValue("");
  expect(save()).toBeDisabled();
});
it("retains management drafts after failure and across selections, and reverts them", async () => {
  saveAssumptionChanges.mockRejectedValueOnce(new Error("Unavailable"));
  render(app());
  await selectFirst();
  type(screen.getByLabelText("Next step (optional)"), "Keep my plan");
  fireEvent.click(save());
  await screen.findByText(/Your edits are retained/);
  fireEvent.click(point(2));
  expect(screen.getByLabelText("Next step (optional)")).toHaveValue("");
  fireEvent.click(point());
  expect(screen.getByLabelText("Next step (optional)")).toHaveValue(
    "Keep my plan",
  );
  fireEvent.click(screen.getByRole("button", { name: "Revert changes" }));
  expect(screen.getByLabelText("Next step (optional)")).toHaveValue("");
  expect(save()).toBeDisabled();
});
it("clears a saved management field and saves all changes through one action", async () => {
  loadAssumptions.mockResolvedValue([
    { ...first, nextStep: "Old plan", helpNeeded: "Keep this" },
    second,
  ]);
  render(app());
  await selectFirst();
  type(screen.getByLabelText("Next step (optional)"), "");
  type(evidence(), "60");
  type(note(), "Pilot completed");
  fireEvent.click(save());
  await screen.findByText("Changes saved.");
  expect(saveAssumptionChanges).toHaveBeenCalledWith(
    user,
    "project-a",
    "a",
    { criticality: 80, evidence: 60 },
    { description: "Pilot completed" },
    { nextStep: "" },
  );
});
