import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReviewsPanel from "./ReviewsPanel.jsx";
import {
  captureReview,
  loadReviews,
  newReviewId,
  publishReview,
} from "./reviewService.js";
vi.mock("./reviewService.js", () => ({
  captureReview: vi.fn(),
  loadReviews: vi.fn(),
  newReviewId: vi.fn(),
  publishReview: vi.fn(),
}));
const snapshot = {
  capturedAt: 10000,
  promises: {
    customerPromise: "Value",
    investorPromise: "Return",
    coworkerPromise: "Culture",
  },
  assumptions: [],
};
const nativeGetComputedStyle = window.getComputedStyle;
beforeEach(() => {
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
    nativeGetComputedStyle(element),
  );
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
  loadReviews.mockResolvedValue([]);
  captureReview.mockResolvedValue({ previous: null, snapshot });
  newReviewId.mockReturnValue("draft-a");
  publishReview.mockResolvedValue();
});
describe("formal review workflow", () => {
  it("retains notes on failed publication and retries with the same ID and reviewed snapshot", async () => {
    publishReview.mockRejectedValueOnce({ code: "unavailable" });
    render(
      <ReviewsPanel
        projectId="p"
        user={{ uid: "u", email: "u@example.org" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/First review: no prior/),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Review notes (optional)"), {
      target: { value: "Agree to test demand" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Publish review" }),
    );
    await within(dialog).findByText(/Your draft is retained/);
    expect(screen.getByLabelText("Review notes (optional)")).toHaveValue(
      "Agree to test demand",
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Publish review" }),
    );
    await waitFor(() => expect(publishReview).toHaveBeenCalledTimes(2));
    expect(publishReview.mock.calls[1][2]).toBe("draft-a");
    expect(publishReview.mock.calls[1][3]).toMatchObject({
      ...snapshot,
      notes: "Agree to test demand",
      previousReviewId: null,
    });
  });
  it("preserves notes when refreshing and cancels without publishing", async () => {
    render(<ReviewsPanel projectId="p" user={{ uid: "u" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText("Review notes (optional)"), {
      target: { value: "Keep this" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh saved state" }),
    );
    await waitFor(() => expect(captureReview).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Review notes (optional)")).toHaveValue(
      "Keep this",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel review" }));
    expect(publishReview).not.toHaveBeenCalled();
  });
});

it("retains an open draft and blocks publication when reviews are disabled remotely", async () => {
  const user = { uid: "u" };
  const { rerender } = render(<ReviewsPanel projectId="p" user={user} />);
  fireEvent.click(screen.getByRole("button", { name: "Start review" }));
  await screen.findByRole("dialog");
  fireEvent.change(screen.getByLabelText("Review notes (optional)"), {
    target: { value: "Keep this discussion" },
  });
  rerender(<ReviewsPanel projectId="p" user={user} enabled={false} />);
  expect(screen.getByLabelText("Review notes (optional)")).toHaveValue(
    "Keep this discussion",
  );
  expect(screen.getByRole("button", { name: "Publish review" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Refresh saved state" }),
  ).toBeDisabled();
  expect(publishReview).not.toHaveBeenCalled();
  rerender(<ReviewsPanel projectId="p" user={user} enabled />);
  expect(screen.getByRole("button", { name: "Publish review" })).toBeEnabled();
});
