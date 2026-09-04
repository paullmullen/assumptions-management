import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import PromiseHistory from "./PromiseHistory.jsx";
import InsightsPanel from "../assumptions/InsightsPanel.jsx";
import { loadPromiseHistory } from "../../services.js";
vi.mock("../../services.js", () => ({
  loadPromiseHistory: vi.fn(),
  loadInsights: vi.fn(async () => [
    {
      id: "a",
      wordingChange: { from: "Original assumption", to: "Revised assumption" },
      authorEmail: "editor@example.com",
      createdAt: { toDate: () => new Date("2026-09-03T12:00:00Z") },
    },
  ]),
}));
it("renders exact assumption wording alongside its author", async () => {
  render(<InsightsPanel projectId="p" assumption={{ id: "a" }} />);
  expect(
    await screen.findByText("Previously: Original assumption"),
  ).toBeInTheDocument();
  expect(screen.getByText("Now: Revised assumption")).toBeInTheDocument();
  expect(screen.getByText(/editor@example.com/)).toBeInTheDocument();
});
it("retries promise history and shows only changed promises", async () => {
  loadPromiseHistory
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce([
      {
        id: "p",
        from: {
          customerPromise: "Original promise",
          investorPromise: "Return",
          coworkerPromise: "Culture",
        },
        to: {
          customerPromise: "New promise",
          investorPromise: "Return",
          coworkerPromise: "Culture",
        },
        authorEmail: "editor@example.com",
      },
    ]);
  render(<PromiseHistory projectId="p" />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry history" }));
  expect(
    await screen.findByText("Previously: Original promise"),
  ).toBeInTheDocument();
  expect(screen.getByText("Now: New promise")).toBeInTheDocument();
  expect(screen.queryByText("Investor promise")).not.toBeInTheDocument();
});
