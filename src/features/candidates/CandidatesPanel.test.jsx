import { loadCandidateGroups } from "./boardService.js";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp } from "antd";
import { beforeEach, expect, it, vi } from "vitest";
import CandidatesPanel from "./CandidatesPanel.jsx";
import {
  addCandidates,
  adoptCandidate,
  editCandidate,
  loadCandidates,
} from "../../services.js";
import { parseCandidates, wordingHint } from "./candidateValues.js";

vi.mock("../../services.js", () => ({
  addCandidates: vi.fn(),
  adoptCandidate: vi.fn(),
  editCandidate: vi.fn(),
  loadCandidates: vi.fn(),
}));
const user = { uid: "owner", email: "owner@example.com" };
const candidate = {
  id: "c1",
  statement: "Customers will pay.",
  status: "pending",
  authorEmail: user.email,
};
const onAdopt = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  loadCandidateGroups.mockResolvedValue([]);
  loadCandidates.mockResolvedValue([candidate]);
});
async function open() {
  render(
    <AntApp>
      <CandidatesPanel projectId="p" user={user} onAdopt={onAdopt} />
    </AntApp>,
  );
  expect(loadCandidates).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Open candidates" }));
  await screen.findByRole("button", { name: "Adopt into portfolio" });
}
it("preserves a draft when hiding and reopening the workshop", async () => {
  await open();
  fireEvent.change(screen.getByLabelText(/one per line/), {
    target: { value: "New idea" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Hide candidates" }));
  fireEvent.click(screen.getByRole("button", { name: "Open candidates" }));
  expect(screen.getByLabelText(/one per line/)).toHaveValue("New idea");
});
it("saves pasted candidates without requiring scores or a follow-up read", async () => {
  await open();
  addCandidates.mockResolvedValue([
    { ...candidate, id: "c2", statement: "New idea" },
  ]);
  fireEvent.change(screen.getByLabelText(/one per line/), {
    target: { value: "New idea" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save candidates" }));
  await waitFor(() =>
    expect(addCandidates).toHaveBeenCalledWith(user, "p", "New idea"),
  );
  await screen.findByText("New idea");
  expect(screen.getByLabelText(/one per line/)).toHaveValue("");
  expect(loadCandidates).toHaveBeenCalledTimes(1);
});
it("retains failed input and can refresh after a load failure", async () => {
  await open();
  addCandidates.mockRejectedValue(new Error("Save failed"));
  fireEvent.change(screen.getByLabelText(/one per line/), {
    target: { value: "Keep me" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save candidates" }));
  await screen.findByText("Save failed");
  expect(screen.getByLabelText(/one per line/)).toHaveValue("Keep me");
  loadCandidates.mockRejectedValueOnce(new Error("offline"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh candidates" }));
  await screen.findByText(/Candidates could not be loaded/);
  expect(
    screen.getByRole("button", { name: "Save candidates" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh candidates" }));
  await screen.findByRole("button", { name: "Adopt into portfolio" });
});
it("edits wording, then opens adoption for the reviewed statement without writing", async () => {
  await open();
  editCandidate.mockResolvedValue("Customers will pay enough.");
  fireEvent.click(screen.getByRole("button", { name: "Edit candidate" }));
  fireEvent.change(screen.getByLabelText("Edit candidate statement"), {
    target: { value: "Customers will pay enough." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save wording" }));
  await screen.findByText("Customers will pay enough.");
  fireEvent.click(screen.getByRole("button", { name: "Adopt into portfolio" }));
  expect(onAdopt).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "c1",
      statement: "Customers will pay enough.",
      status: "pending",
    }),
    expect.any(Function),
  );
  expect(adoptCandidate).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Adopt into portfolio" }),
  ).toBeEnabled();
});
it("validates bulk input and gives nonblocking wording hints", () => {
  expect(parseCandidates(" A\r\n\nB ")).toEqual(["A", "B"]);
  expect(() => parseCandidates(" \n ")).toThrow();
  expect(() => parseCandidates("A\n".repeat(21))).toThrow(/20/);
  expect(() => parseCandidates("A".repeat(2001))).toThrow(/2,000/);
  expect(wordingHint("Will it work?")).toBe(true);
  expect(wordingHint("Interview customers")).toBe(true);
  expect(wordingHint("Customers will pay")).toBe(false);
});

vi.mock("./boardService.js", () => ({
  loadCandidateGroups: vi.fn(async () => []),
  newBoardId: vi.fn(() => "new-board-id"),
  saveCandidateGroup: vi.fn(),
  combineCandidates: vi.fn(),
  moveCandidate: vi.fn(),
}));
