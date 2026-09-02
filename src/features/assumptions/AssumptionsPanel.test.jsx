import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { App as AntApp } from "antd";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import AssumptionsPanel from "./AssumptionsPanel.jsx";
import { loadAssumptions, updateAssumptionScores } from "../../services.js";

vi.mock("../../services.js", () => ({
  loadAssumptions: vi.fn(),
  updateAssumptionScores: vi.fn(),
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
const user = { uid: "owner" };

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
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
  vi.clearAllMocks();
  loadAssumptions.mockResolvedValue([first, second, unassessed]);
  updateAssumptionScores.mockResolvedValue();
});

function app(projectId = "project-a") {
  return (
    <AntApp>
      <AssumptionsPanel projectId={projectId} user={user} />
    </AntApp>
  );
}

async function row(statement = first.statement) {
  return screen.findByRole("group", { name: `Saved assumption: ${statement}` });
}

function point(number = 1) {
  return screen.getByRole("button", {
    name: new RegExp(`^Assumption ${number}:`),
  });
}

describe("shared assumption selection", () => {
  it("selects from the chart by keyboard and from the saved list", async () => {
    render(app());
    const firstRow = await row();
    fireEvent.keyDown(point(), { key: "Enter" });
    expect(firstRow).toHaveClass("saved-assumption-selected");
    expect(point()).toHaveAttribute("aria-pressed", "true");
    const secondRow = await row(second.statement);
    fireEvent.click(
      within(secondRow).getByRole("button", { name: "Select assumption" }),
    );
    expect(point(2)).toHaveAttribute("aria-pressed", "true");
    expect(firstRow).not.toHaveClass("saved-assumption-selected");
  });

  it("selects through the chart key without writing scores", async () => {
    const { container } = render(app());
    const firstRow = await row();
    fireEvent.click(container.querySelector(".portfolio-key-button"));
    expect(firstRow).toHaveClass("saved-assumption-selected");
    expect(point()).toHaveAttribute("aria-pressed", "true");
    expect(updateAssumptionScores).not.toHaveBeenCalled();
  });

  it("immediately opens the chart editor and refreshes the point after saving", async () => {
    render(app());
    await row();
    fireEvent.click(point());
    const editor = screen.getByRole("region", {
      name: "Selected assumption score editor",
    });
    expect(
      within(editor).queryByRole("button", { name: "Update scores" }),
    ).not.toBeInTheDocument();
    const input = screen.getByRole("spinbutton", {
      name: "Criticality if wrong",
    });
    expect(input).toHaveValue("80");
    fireEvent.change(
      screen.getByRole("spinbutton", {
        name: "Strength of supporting evidence",
      }),
      { target: { value: "60" } },
    );
    loadAssumptions.mockResolvedValue([
      { ...first, evidence: 60 },
      second,
      unassessed,
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Save scores" }));
    await waitFor(() =>
      expect(updateAssumptionScores).toHaveBeenCalledWith(
        user,
        "project-a",
        "a",
        { criticality: 80, evidence: 60 },
      ),
    );
    await waitFor(() =>
      expect(point()).toHaveAttribute(
        "aria-label",
        expect.stringContaining("evidence 60"),
      ),
    );
    expect(point()).toHaveAttribute("aria-pressed", "true");
    expect(input).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save scores" }),
      ).toBeDisabled(),
    );
  });

  it("preserves drafts across selections and reverts without saving", async () => {
    render(app());
    await row();
    fireEvent.click(point());
    const evidence = () =>
      screen.getByRole("spinbutton", {
        name: "Strength of supporting evidence",
      });
    fireEvent.change(evidence(), { target: { value: "55" } });
    fireEvent.click(point(2));
    expect(evidence()).toHaveValue("70");
    fireEvent.click(point());
    expect(evidence()).toHaveValue("55");
    fireEvent.click(screen.getByRole("button", { name: "Revert changes" }));
    expect(evidence()).toHaveValue("20");
    expect(updateAssumptionScores).not.toHaveBeenCalled();
  });

  it("retains edits and the saved point after a failed save", async () => {
    updateAssumptionScores.mockRejectedValueOnce(new Error("Unavailable"));
    render(app());
    await row();
    fireEvent.click(point());
    const evidence = screen.getByRole("spinbutton", {
      name: "Strength of supporting evidence",
    });
    fireEvent.change(evidence, { target: { value: "55" } });
    fireEvent.click(screen.getByRole("button", { name: "Save scores" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your edits are retained",
    );
    expect(evidence).toHaveValue("55");
    expect(point()).toHaveAttribute(
      "aria-label",
      expect.stringContaining("evidence 20"),
    );
  });

  it("keeps unassessed assumptions off the chart and cancels without writing", async () => {
    render(app());
    const item = await row(unassessed.statement);
    fireEvent.click(
      within(item).getByRole("button", { name: "Select assumption" }),
    );
    expect(point()).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("spinbutton", { name: "Criticality if wrong" }),
    ).toHaveValue("");
    expect(
      screen.getByRole("spinbutton", {
        name: "Strength of supporting evidence",
      }),
    ).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save scores" })).toBeDisabled();
    fireEvent.click(within(item).getByRole("button", { name: "Assess" }));
    fireEvent.click(within(item).getByRole("button", { name: "Cancel" }));
    expect(updateAssumptionScores).not.toHaveBeenCalled();
    expect(within(item).getByText("Not assessed")).toBeInTheDocument();
  });

  it("clears selection and the editor on project switch", async () => {
    const { rerender } = render(app());
    const item = await row();
    fireEvent.click(
      within(item).getByRole("button", { name: "Update scores" }),
    );
    rerender(app("project-b"));
    await row();
    expect(point()).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("spinbutton", { name: "Criticality score" }),
    ).not.toBeInTheDocument();
    expect(loadAssumptions).toHaveBeenLastCalledWith("project-b");
  });
});
