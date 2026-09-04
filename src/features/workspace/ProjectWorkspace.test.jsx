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
import ProjectWorkspace from "./ProjectWorkspace.jsx";
import DraftProvider from "./DraftProvider.jsx";
import * as services from "../../services.js";
import * as preferences from "../reviews/reviewPreference.js";
import * as reviews from "../reviews/reviewService.js";

vi.mock("../reports/reportService.js", () => ({
  loadReportSource: vi.fn(),
  loadReportComparison: vi.fn(async () => null),
  loadReportReviews: vi.fn(),
  verifyReportAccess: vi.fn(),
}));

vi.mock("../reviews/reviewPreference.js", () => ({
  watchReviewPreference: vi.fn(),
  saveReviewPreference: vi.fn(),
}));
vi.mock("../../services.js", () => ({
  loadAssumptions: vi.fn(),
  loadCandidates: vi.fn(),
  loadInsights: vi.fn(),
  loadProjectBrief: vi.fn(),
  saveProjectBrief: vi.fn(),
  saveAssumptionChanges: vi.fn(),
  saveAssumptionDraft: vi.fn(),
  updateAssumption: vi.fn(),
  addBasicAssumption: vi.fn(),
  addCandidates: vi.fn(),
  adoptCandidate: vi.fn(),
  editCandidate: vi.fn(),
}));
vi.mock("../reviews/reviewService.js", () => ({
  loadReviews: vi.fn(),
  captureReview: vi.fn(),
  newReviewId: vi.fn(),
  publishReview: vi.fn(),
}));
vi.mock("../members/MembersPanel.jsx", () => ({
  default: () => <div>Owner membership controls</div>,
}));
const assumptions = [
  {
    id: "a",
    statement: "Customers will adopt it.",
    criticality: 80,
    evidence: 20,
  },
  { id: "b", statement: "We can support it." },
];
const user = { uid: "owner", email: "owner@example.test" };
const project = { id: "p", name: "Pilot project", creatorId: "owner" };
const promises = {
  customerPromise: "Customer value",
  investorPromise: "Investor return",
  coworkerPromise: "Healthy culture",
};
const point = () => screen.getByRole("button", { name: /^Assumption 1:/ });
const note = () => screen.getByLabelText("New insight (optional)");
const click = (name) =>
  fireEvent.click(
    screen.getByRole("button", { name, exact: typeof name === "string" }),
  );
const modal = () =>
  screen
    .getByText("Unsaved changes", { selector: ".ant-modal-title" })
    .closest('[role="dialog"]');
function app(props = {}) {
  return (
    <AntApp>
      <DraftProvider>
        <ProjectWorkspace
          project={project}
          user={user}
          onBack={vi.fn()}
          {...props}
        />
      </DraftProvider>
    </AntApp>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  preferences.watchReviewPreference.mockImplementation((_id, callback) => {
    callback(true);
    return vi.fn();
  });
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  services.loadAssumptions.mockResolvedValue(assumptions);
  services.loadCandidates.mockResolvedValue([
    {
      id: "c",
      statement: "Delivery costs remain manageable.",
      status: "pending",
    },
  ]);
  services.loadInsights.mockResolvedValue([]);
  services.loadProjectBrief.mockResolvedValue(promises);
  services.saveAssumptionDraft.mockImplementation(
    async (_user, _project, id, baseline, draft, insight) => ({
      assumption: { ...baseline, ...draft, id },
      insight: insight.description
        ? { id: "note", description: insight.description }
        : null,
    }),
  );
  reviews.loadReviews.mockResolvedValue([]);
});
it("opens portfolio with one list, hidden promises, separate candidates/reviews and owner-only settings", async () => {
  render(app());
  await screen.findByRole("button", { name: /^Assumption 1:/ });
  expect(
    screen.getAllByRole("group", { name: /^Saved assumption:/ }),
  ).toHaveLength(2);
  expect(screen.queryByText("Saved assumptions")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("textbox", { name: /promise.*customer/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("Owner membership controls"),
  ).not.toBeInTheDocument();
  click(/^Candidates/);
  expect(
    screen.getByLabelText("Candidate assumptions — one per line"),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: /^Assumption 1:/ }),
  ).not.toBeInTheDocument();
  click("Reviews");
  expect(
    await screen.findByRole("button", { name: "Start review" }),
  ).toBeVisible();
  click("Settings & access");
  expect(screen.getByText("Owner membership controls")).toBeVisible();
});
it("keeps a dirty insight on selection and failed save; saves before a view change", async () => {
  services.saveAssumptionDraft.mockRejectedValueOnce(new Error("offline"));
  render(app());
  await screen.findByRole("button", { name: /^Assumption 1:/ });
  fireEvent.click(point());
  fireEvent.change(note(), { target: { value: "New finding" } });
  fireEvent.click(
    within(
      screen.getByRole("group", {
        name: "Saved assumption: We can support it.",
      }),
    ).getByRole("button", { name: /^Open assumption/ }),
  );
  expect(modal()).toHaveTextContent("Assumption changes");
  click("Keep editing");
  expect(note()).toHaveValue("New finding");
  click(/^Candidates/);
  click("Save and continue");
  await screen.findByText(/Changes were not saved/);
  expect(note()).toHaveValue("New finding");
  expect(point()).toHaveAttribute("aria-pressed", "true");
  click("Save and continue");
  await waitFor(() =>
    expect(
      screen.getByLabelText("Candidate assumptions — one per line"),
    ).toBeVisible(),
  );
  expect(services.saveAssumptionDraft).toHaveBeenCalledTimes(2);
  click("Portfolio");
  expect(note()).toHaveValue("");
});
it("protects an incomplete insight source and permits explicit discard before selection", async () => {
  render(app());
  await screen.findByRole("button", { name: /^Assumption 1:/ });
  fireEvent.click(point());
  fireEvent.change(screen.getByLabelText("Source URL (optional)"), {
    target: { value: "https://example.test" },
  });
  fireEvent.click(
    within(
      screen.getByRole("group", {
        name: "Saved assumption: We can support it.",
      }),
    ).getByRole("button", { name: /^Open assumption/ }),
  );
  click("Save and continue");
  await screen.findByText(/Changes were not saved/);
  expect(services.saveAssumptionDraft).not.toHaveBeenCalled();
  click("Discard changes");
  await waitFor(() =>
    expect(screen.getByLabelText("Criticality if wrong")).toHaveValue(""),
  );
  expect(screen.getByLabelText("Source URL (optional)")).toHaveValue("");
});
it("protects promises when collapsing and preserves valid saves", async () => {
  render(app());
  await screen.findByRole("button", { name: /^Assumption 1:/ });
  click("Three Promises");
  const customer = screen.getByLabelText(
    "What promise are you making to the customer?",
  );
  fireEvent.change(customer, { target: { value: "Better customer value" } });
  click("Three Promises");
  click("Keep editing");
  expect(customer).toHaveValue("Better customer value");
  click("Three Promises");
  click("Save and continue");
  await waitFor(() => expect(customer).not.toBeVisible());
  expect(services.saveProjectBrief).toHaveBeenCalledWith(
    "p",
    user,
    {
      ...promises,
      customerPromise: "Better customer value",
    },
    promises,
  );
});
it("protects candidate capture and adoption returns to the sole portfolio list", async () => {
  services.adoptCandidate.mockResolvedValue({
    id: "c",
    statement: "Delivery costs remain manageable.",
    sourceCandidateId: "c",
  });
  render(app());
  await screen.findByRole("button", { name: /^Candidates \(1\)/ });
  click(/^Candidates/);
  fireEvent.change(
    screen.getByLabelText("Candidate assumptions — one per line"),
    { target: { value: "Unfinished candidate" } },
  );
  click("Adopt into portfolio");
  expect(services.adoptCandidate).not.toHaveBeenCalled();
  click("Keep editing");
  click("Portfolio");
  click("Discard changes");
  click(/^Candidates/);
  expect(
    screen.getByLabelText("Candidate assumptions — one per line"),
  ).toHaveValue("");
  click("Adopt into portfolio");
  expect(services.adoptCandidate).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Adopt with scores" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Criticality if wrong"), {
    target: { value: "0" },
  });
  fireEvent.change(screen.getByLabelText("Strength of supporting evidence"), {
    target: { value: "50" },
  });
  services.adoptCandidate.mockResolvedValue({
    id: "c",
    statement: "Delivery costs remain manageable.",
    sourceCandidateId: "c",
    criticality: 0,
    evidence: 50,
  });
  click("Adopt with scores");
  await waitFor(() =>
    expect(
      screen.getByRole("group", {
        name: "Saved assumption: Delivery costs remain manageable.",
      }),
    ).toBeVisible(),
  );
  expect(
    screen.getAllByRole("group", { name: /^Saved assumption:/ }),
  ).toHaveLength(3);
  expect(screen.getByLabelText("Criticality if wrong")).toHaveValue("0");
});
it("never publishes an unpublished review through the navigation guard", async () => {
  reviews.captureReview.mockResolvedValue({
    snapshot: { capturedAt: Date.now(), promises, assumptions: [] },
    previous: null,
  });
  reviews.newReviewId.mockReturnValue("review");
  render(app());
  await screen.findByRole("button", { name: /^Assumption 1:/ });
  click("Reviews");
  click("Start review");
  await screen.findByRole("dialog", { name: "Review current portfolio" });
  click("Cancel review");
  expect(modal()).toHaveTextContent("Unsaved review");
  expect(
    within(modal()).queryByRole("button", { name: "Save and continue" }),
  ).not.toBeInTheDocument();
  click("Discard changes");
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Review current portfolio" }),
    ).not.toBeInTheDocument(),
  );
  expect(reviews.publishReview).not.toHaveBeenCalled();
});
it("removes private draft UI when the workspace is unmounted after access loss", async () => {
  const { rerender } = render(app());
  await screen.findByRole("button", { name: /^Assumption 1:/ });
  fireEvent.click(point());
  fireEvent.change(note(), { target: { value: "Private draft" } });
  click(/^Candidates/);
  expect(modal()).toBeInTheDocument();
  rerender(
    <AntApp>
      <DraftProvider>
        <p>Project unavailable</p>
      </DraftProvider>
    </AntApp>,
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(screen.queryByDisplayValue("Private draft")).not.toBeInTheDocument();
});
it("updates guide destinations to open the promises and candidate views", async () => {
  render(app());
  await screen.findByRole("button", { name: /^Assumption 1:/ });
  click("Open guided start");
  click("Go to promises");
  expect(
    screen.getByRole("region", { name: "Project promises" }),
  ).toHaveFocus();
  click("Open guided start");
  click("Next");
  click("Skip for now");
  click("Go to candidates");
  expect(
    screen.getByRole("region", { name: "Project candidates" }),
  ).toHaveFocus();
  expect(
    screen.getByLabelText("Candidate assumptions — one per line"),
  ).toBeVisible();
});

it("lets the owner toggle reviews and keeps history available when disabled", async () => {
  let change;
  preferences.watchReviewPreference.mockImplementation((_id, callback) => {
    change = callback;
    callback(false);
    return vi.fn();
  });
  preferences.saveReviewPreference.mockImplementation(
    async (_id, _user, enabled) => change(enabled),
  );
  render(app());
  await screen.findByRole("button", { name: /^Assumption 1:/ });
  click("Review history");
  expect(
    screen.queryByRole("button", { name: "Start review" }),
  ).not.toBeInTheDocument();
  click("Settings & access");
  fireEvent.click(screen.getByRole("switch", { name: "Use formal reviews" }));
  await waitFor(() =>
    expect(preferences.saveReviewPreference).toHaveBeenCalledWith(
      "p",
      user,
      true,
    ),
  );
  click("Reviews");
  expect(screen.getByRole("button", { name: "Start review" })).toBeVisible();
});
it("retains the saved preference after failure and disables member controls", async () => {
  preferences.saveReviewPreference.mockRejectedValue(new Error("offline"));
  const { unmount } = render(app());
  click("Settings & access");
  fireEvent.click(screen.getByRole("switch", { name: "Use formal reviews" }));
  await screen.findByText(/preference was not saved/);
  expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  unmount();
  render(app({ user: { uid: "member" } }));
  click("Settings & access");
  expect(screen.getByRole("switch")).toBeDisabled();
});

it("keeps permission errors beside the switch after a rollback snapshot and clears them only on retry", async () => {
  let receive;
  preferences.watchReviewPreference.mockImplementation((_id, callback) => {
    receive = callback;
    callback(true);
    return vi.fn();
  });
  preferences.saveReviewPreference.mockRejectedValueOnce({
    code: "permission-denied",
  });
  render(app());
  click("Settings & access");
  fireEvent.click(screen.getByRole("switch", { name: "Use formal reviews" }));
  await screen.findByText(/not saved: permission denied/);
  act(() => receive(true)); // A rollback / unrelated document update must not erase the failure.
  expect(screen.getByRole("alert")).toHaveTextContent(
    "deployed Firestore rules",
  );
  expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  expect(screen.getByRole("status")).toHaveTextContent(
    "Saved preference: formal reviews on.",
  );
  preferences.saveReviewPreference.mockImplementationOnce(async () =>
    receive(false),
  );
  fireEvent.click(screen.getByRole("switch", { name: "Use formal reviews" }));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(
      "Saved preference: formal reviews off.",
    ),
  );
  expect(
    screen.queryByText(/not saved: permission denied/),
  ).not.toBeInTheDocument();
});

it("cancels an untouched adoption without writing and protects partially scored drafts", async () => {
  render(app());
  await screen.findByRole("button", { name: /^Candidates \(1\)/ });
  click(/^Candidates/);
  click("Adopt into portfolio");
  expect(screen.getByLabelText("Assumption")).toHaveAttribute("readonly");
  expect(screen.getByLabelText("Criticality if wrong")).toHaveValue("");
  click("Close assumption");
  expect(services.adoptCandidate).not.toHaveBeenCalled();
  click("Adopt into portfolio");
  fireEvent.change(screen.getByLabelText("Criticality if wrong"), {
    target: { value: "0" },
  });
  expect(
    screen.getByRole("button", { name: "Adopt with scores" }),
  ).toBeDisabled();
  click("Close assumption");
  expect(modal()).toHaveTextContent("Candidate adoption");
  click("Keep editing");
  expect(screen.getByLabelText("Criticality if wrong")).toHaveValue("0");
  click("Portfolio");
  click("Discard changes");
  click(/^Candidates/);
  expect(
    screen.getByRole("button", { name: "Adopt into portfolio" }),
  ).toBeVisible();
  expect(services.adoptCandidate).not.toHaveBeenCalled();
});

it("retains adoption scores and insight on failure and requires review of changed candidate wording", async () => {
  services.adoptCandidate.mockRejectedValueOnce(new Error("offline"));
  render(app());
  await screen.findByRole("button", { name: /^Candidates \(1\)/ });
  click(/^Candidates/);
  click("Adopt into portfolio");
  fireEvent.change(screen.getByLabelText("Criticality if wrong"), {
    target: { value: "90" },
  });
  fireEvent.change(screen.getByLabelText("Strength of supporting evidence"), {
    target: { value: "0" },
  });
  fireEvent.change(note(), { target: { value: "Initial judgment" } });
  click("Adopt with scores");
  await screen.findByText(/Changes could not be saved/);
  expect(note()).toHaveValue("Initial judgment");
  services.adoptCandidate.mockRejectedValueOnce({
    code: "candidate-conflict",
    current: {
      id: "c",
      statement: "Delivery costs stay below our target.",
      status: "pending",
    },
  });
  click("Adopt with scores");
  await screen.findByText("The candidate wording changed");
  expect(
    screen.getByRole("button", { name: "Adopt with scores" }),
  ).toBeDisabled();
  click("Use latest candidate wording");
  expect(screen.getByLabelText("Assumption")).toHaveValue(
    "Delivery costs stay below our target.",
  );
  expect(screen.getByLabelText("Criticality if wrong")).toHaveValue("90");
  expect(note()).toHaveValue("Initial judgment");
  services.adoptCandidate.mockResolvedValueOnce({
    id: "c",
    statement: "Delivery costs stay below our target.",
    sourceCandidateId: "c",
    criticality: 90,
    evidence: 0,
  });
  click("Adopt with scores");
  await screen.findByRole("group", {
    name: "Saved assumption: Delivery costs stay below our target.",
  });
  const calls = services.adoptCandidate.mock.calls;
  expect(calls[2][3]).toBe("Delivery costs stay below our target.");
  expect(calls[2][6]).toBe(calls[0][6]); // Safe retry retains its operation identity.
  click(/^Candidates/);
  expect(
    screen.queryByRole("button", { name: "Adopt into portfolio" }),
  ).not.toBeInTheDocument();
});

it("does not overwrite a candidate adopted by another user", async () => {
  services.adoptCandidate.mockRejectedValueOnce({
    code: "candidate-adopted",
    message: "This candidate has already been adopted. Your draft is retained.",
  });
  render(app());
  await screen.findByRole("button", { name: /^Candidates \(1\)/ });
  click(/^Candidates/);
  click("Adopt into portfolio");
  fireEvent.change(screen.getByLabelText("Criticality if wrong"), {
    target: { value: "40" },
  });
  fireEvent.change(screen.getByLabelText("Strength of supporting evidence"), {
    target: { value: "70" },
  });
  click("Adopt with scores");
  await screen.findByText(/already been adopted/);
  expect(screen.getByLabelText("Strength of supporting evidence")).toHaveValue(
    "70",
  );
  expect(services.saveAssumptionDraft).not.toHaveBeenCalled();
});

it("saves an adoption before switching to another candidate and keeps its drawer visible", async () => {
  services.loadCandidates.mockResolvedValue([
    { id: "c", statement: "First candidate", status: "pending" },
    { id: "d", statement: "Second candidate", status: "pending" },
  ]);
  services.adoptCandidate.mockResolvedValue({
    id: "c",
    statement: "First candidate",
    sourceCandidateId: "c",
    criticality: 10,
    evidence: 20,
  });
  render(app());
  await screen.findByRole("button", { name: /^Candidates \(2\)/ });
  click(/^Candidates/);
  const adopt = (statement) =>
    within(
      screen.getByRole("group", { name: `Candidate: ${statement}` }),
    ).getByRole("button", { name: "Adopt into portfolio" });
  fireEvent.click(adopt("First candidate"));
  expect(adopt("First candidate")).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Criticality if wrong"), {
    target: { value: "10" },
  });
  fireEvent.change(screen.getByLabelText("Strength of supporting evidence"), {
    target: { value: "20" },
  });
  fireEvent.click(adopt("Second candidate"));
  click("Save and continue");
  await waitFor(() =>
    expect(screen.getByLabelText("Assumption")).toHaveValue("Second candidate"),
  );
  expect(screen.getByLabelText("Criticality if wrong")).toHaveValue("");
  expect(
    screen.getByRole("button", { name: "Adopt with scores" }),
  ).toBeVisible();
  expect(services.adoptCandidate).toHaveBeenCalledTimes(1);
});

it("opens guidance as its own view and protects edits before returning to it", async () => {
  services.saveAssumptionDraft.mockRejectedValueOnce(new Error("offline"));
  render(app());
  await screen.findByRole("button", { name: /^Assumption 1:/ });
  click("Open guided start");
  expect(screen.getByRole("heading", { name: /1 of 6/ })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: /^Assumption 1:/ }),
  ).not.toBeInTheDocument();
  click("Pause guidance");
  fireEvent.click(point());
  fireEvent.change(note(), { target: { value: "Keep this insight" } });
  click("Open guided start");
  expect(modal()).toBeInTheDocument();
  click("Save and continue");
  await screen.findByText(/Changes were not saved/);
  expect(note()).toHaveValue("Keep this insight");
  expect(
    screen.queryByRole("heading", { name: /1 of 6/ }),
  ).not.toBeInTheDocument();
  click("Keep editing");
  click("Open guided start");
  click("Discard changes");
  await screen.findByRole("heading", { name: /1 of 6/ });
  expect(
    screen.queryByRole("dialog", { name: /Assumption/ }),
  ).not.toBeInTheDocument();
  click("Go to promises");
  expect(
    screen.getByRole("region", { name: "Project promises" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("dialog", { name: /Assumption/ }),
  ).not.toBeInTheDocument();
});

vi.mock("../candidates/boardService.js", () => ({
  loadCandidateGroups: vi.fn(async () => []),
  newBoardId: vi.fn(() => "new-board-id"),
  saveCandidateGroup: vi.fn(),
  combineCandidates: vi.fn(),
  moveCandidate: vi.fn(),
}));

it("opens the owner's existing invitation controls from guided startup", async () => {
  render(app());
  await screen.findByRole("button", { name: /^Assumption 1:/ });
  click("Open guided start");
  click("Next");
  click("Invite team members");
  expect(
    screen.getByRole("region", { name: "Project settings and access" }),
  ).toBeVisible();
  expect(screen.getByText("Owner membership controls")).toBeVisible();
});
