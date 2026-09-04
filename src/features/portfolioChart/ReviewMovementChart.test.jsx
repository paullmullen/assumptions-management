import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import ReviewMovementChart from "./ReviewMovementChart.jsx";
import { loadReportReviews } from "../reports/reportService.js";
import { reviewMovement } from "./reviewMovement.js";
vi.mock("../reports/reportService.js", () => ({ loadReportReviews: vi.fn() }));
const assumptions = [
  { id: "a", statement: "New wording", criticality: 80, evidence: 60 },
  { id: "b", statement: "New idea", criticality: 0, evidence: 0 },
];
const review = {
  title: "Baseline",
  capturedAt: 1,
  assumptions: [
    { id: "a", statement: "Old wording", criticality: 80, evidence: 20 },
  ],
};
beforeEach(() => vi.resetAllMocks());
it("loads only on request, draws net movement without changing selection targets, and hides it", async () => {
  loadReportReviews.mockResolvedValue([review]);
  const onSelect = vi.fn();
  const { container } = render(
    <ReviewMovementChart
      projectId="p"
      assumptions={assumptions}
      onSelect={onSelect}
    />,
  );
  expect(loadReportReviews).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Show movement since last review" }),
  );
  await screen.findByText(/Since saved review/);
  expect(container.querySelectorAll(".portfolio-movement line")).toHaveLength(
    1,
  );
  expect(
    screen.getByText(/Wording changed; compare scores with care/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/New since review; no prior position/),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: /Assumption 1: New wording/ }),
  );
  expect(onSelect).toHaveBeenCalledWith("a", expect.anything());
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Show movement since last review" }),
  );
  expect(container.querySelectorAll(".portfolio-movement line")).toHaveLength(
    0,
  );
});
it("shows a retryable failure, then no previous review without inventing movement", async () => {
  loadReportReviews
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue([]);
  render(
    <ReviewMovementChart
      projectId="p"
      assumptions={assumptions}
      onSelect={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Show movement since last review" }),
  );
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Retry movement" }));
  await screen.findByText(/No previous review/);
  expect(
    screen.getAllByRole("button", { name: /Assumption \d:/ }),
  ).toHaveLength(2);
});
it("does not invent arrows for missing scores or unchanged pairs and handles zero", () => {
  const rows = reviewMovement(
    [
      { id: "a", criticality: 0, evidence: 0 },
      { id: "b" },
      { id: "c", criticality: 20, evidence: 20 },
    ],
    {
      assumptions: [
        { id: "a", criticality: 1, evidence: 0 },
        { id: "b", criticality: 20, evidence: 20 },
        { id: "c", criticality: 20, evidence: 20 },
      ],
    },
  );
  expect(rows.map((row) => row.changed)).toEqual([true, false, false]);
  expect(rows[1].description).toContain("not assessed");
});

it("blocks movement from a baseline newer than the loaded portfolio", async () => {
  loadReportReviews.mockResolvedValue([{ ...review, capturedAt: 200 }]);
  const refresh = vi.fn();
  const { container } = render(
    <ReviewMovementChart
      projectId="p"
      portfolioLoadedAt={100}
      onRefreshPortfolio={refresh}
      assumptions={assumptions}
      onSelect={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Show movement since last review" }),
  );
  await screen.findByText(/This review is newer/);
  expect(container.querySelectorAll(".portfolio-movement line")).toHaveLength(
    0,
  );
  fireEvent.click(screen.getByRole("button", { name: "Refresh portfolio" }));
  expect(refresh).toHaveBeenCalled();
});
