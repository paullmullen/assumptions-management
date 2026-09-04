import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { App } from "antd";
import { beforeEach, expect, it, vi } from "vitest";
import CandidatesPanel from "./CandidatesPanel.jsx";
import DraftProvider from "../workspace/DraftProvider.jsx";
import { loadCandidates } from "../../services.js";
import {
  loadCandidateGroups,
  combineCandidates,
  newBoardId,
  moveCandidate,
  saveCandidateGroup,
} from "./boardService.js";
import { moveOrder, validateCombination } from "./boardValues.js";
vi.mock("../../services.js", () => ({
  loadCandidates: vi.fn(),
  addCandidates: vi.fn(),
  editCandidate: vi.fn(),
}));
vi.mock("./boardService.js", () => ({
  loadCandidateGroups: vi.fn(),
  combineCandidates: vi.fn(),
  newBoardId: vi.fn(),
  moveCandidate: vi.fn(),
  saveCandidateGroup: vi.fn(),
}));
const user = { uid: "u", email: "u@example.com" };
const records = [
  {
    id: "a",
    statement: "First idea",
    status: "pending",
    authorEmail: "alex@example.com",
  },
  {
    id: "b",
    statement: "Second idea",
    status: "pending",
    authorEmail: "sam@example.com",
  },
];
beforeEach(() => {
  vi.resetAllMocks();
  loadCandidates.mockResolvedValue(records);
  loadCandidateGroups.mockResolvedValue([{ id: "delivery", name: "Delivery" }]);
  newBoardId.mockReturnValue("combined");
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});
async function open() {
  render(
    <App>
      <DraftProvider>
        <CandidatesPanel projectId="p" user={user} expanded onAdopt={vi.fn()} />
      </DraftProvider>
    </App>,
  );
  await screen.findByRole("checkbox", { name: "Select candidate: First idea" });
}
async function startCombine() {
  await open();
  for (const name of ["First idea", "Second idea"])
    fireEvent.click(
      screen.getByRole("checkbox", { name: `Select candidate: ${name}` }),
    );
  fireEvent.click(screen.getByRole("button", { name: "Combine selected" }));
  await screen.findByLabelText("Combined assumption wording");
}
it("keeps failed combination wording, guards close, and preserves source attribution on success", async () => {
  await startCombine();
  fireEvent.change(screen.getByLabelText("Combined assumption wording"), {
    target: { value: "Consolidated idea" },
  });
  combineCandidates.mockRejectedValueOnce(
    new Error("A selected candidate changed."),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Create combined candidate" }),
  );
  await screen.findByText("A selected candidate changed.");
  expect(screen.getByLabelText("Combined assumption wording")).toHaveValue(
    "Consolidated idea",
  );
  fireEvent.click(
    within(
      screen.getByRole("dialog", { name: "Combine candidates" }),
    ).getByRole("button", { name: "Close" }),
  );
  await screen.findByRole("dialog", { name: "Unsaved changes" });
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  combineCandidates.mockResolvedValue({
    ...records[0],
    id: "combined",
    statement: "Consolidated idea",
    sourceCandidateIds: ["a", "b"],
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Create combined candidate" }),
  );
  await screen.findByRole("checkbox", {
    name: "Select candidate: Consolidated idea",
  });
  expect(
    screen.queryByRole("checkbox", { name: "Select candidate: First idea" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Source candidates (2)"));
  expect(screen.getByText("sam@example.com", { exact: false })).toBeVisible();
  expect(combineCandidates).toHaveBeenLastCalledWith(
    user,
    "p",
    "combined",
    records,
    "Consolidated idea",
  );
});
it("does not move a card on failed save, then updates only after acknowledgement", async () => {
  await open();
  moveCandidate.mockRejectedValueOnce(new Error("Move failed"));
  fireEvent.click(
    screen.getByRole("button", { name: "Move down: First idea" }),
  );
  await screen.findByText("Move failed");
  const lane = screen.getByRole("region", { name: "Group: Ungrouped" });
  expect(within(lane).getAllByRole("checkbox")[0]).toHaveAccessibleName(
    "Select candidate: First idea",
  );
  moveCandidate.mockResolvedValue([
    { ...records[1], rank: 1024, groupId: "ungrouped" },
    { ...records[0], rank: 2048, groupId: "ungrouped" },
  ]);
  fireEvent.click(
    screen.getByRole("button", { name: "Move down: First idea" }),
  );
  await waitFor(() =>
    expect(within(lane).getAllByRole("checkbox")[0]).toHaveAccessibleName(
      "Select candidate: Second idea",
    ),
  );
});
it("creates a named group and retains pending cards when switching to list", async () => {
  await open();
  fireEvent.click(screen.getByRole("button", { name: "Add group" }));
  fireEvent.change(screen.getByLabelText("Group name"), {
    target: { value: "Customer value" },
  });
  saveCandidateGroup.mockResolvedValue({ id: "new", name: "Customer value" });
  fireEvent.click(screen.getByRole("button", { name: "Save group" }));
  await screen.findByRole("region", { name: "Group: Customer value" });
  fireEvent.click(screen.getByText("List", { exact: true }));
  expect(
    screen.getByRole("group", { name: "Candidate: First idea" }),
  ).toBeVisible();
  expect(
    screen.getAllByRole("button", { name: "Adopt into portfolio" }),
  ).toHaveLength(2);
});
it("handles tied legacy positions and rejects duplicate or completed combination sources", () => {
  expect(
    moveOrder(records, "ungrouped", records[1], "a").map((row) => row.id),
  ).toEqual(["b", "a"]);
  expect(() =>
    validateCombination([records[0], records[0]], "Combined"),
  ).toThrow(/different/);
  expect(() =>
    validateCombination(
      [records[0], { ...records[1], status: "adopted" }],
      "Combined",
    ),
  ).toThrow(/pending/);
});
