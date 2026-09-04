import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { App } from "antd";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import DraftProvider from "../workspace/DraftProvider.jsx";
import ReportWorkspace from "./ReportWorkspace.jsx";
import {
  loadReportComparison,
  loadReportSource,
  verifyReportAccess,
} from "./reportService.js";
vi.mock("./reportService.js", () => ({
  loadReportSource: vi.fn(),
  loadReportComparison: vi.fn(async () => null),
  loadReportReviews: vi.fn(async () => []),
  verifyReportAccess: vi.fn(async () => ({})),
}));
vi.mock("../portfolioChart/PortfolioChart.jsx", () => ({
  default: ({ assumptions }) => (
    <div>Chart: {assumptions.length} assumptions</div>
  ),
}));
const source = {
  kind: "current",
  projectName: "Pilot",
  loadedAt: 1000,
  promises: { customerPromise: "Customer value" },
  assumptions: Array.from({ length: 5 }, (_, i) => ({
    id: String(i),
    statement: `Statement ${i + 1}`,
    criticality: 80,
    evidence: 20,
  })),
};
let width, height, scrollHeight, scrollWidth;
beforeEach(() => {
  vi.clearAllMocks();
  loadReportSource.mockResolvedValue(source);
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
  width = vi
    .spyOn(HTMLElement.prototype, "clientWidth", "get")
    .mockReturnValue(1000);
  height = vi
    .spyOn(HTMLElement.prototype, "clientHeight", "get")
    .mockReturnValue(750);
  scrollHeight = vi
    .spyOn(HTMLElement.prototype, "scrollHeight", "get")
    .mockReturnValue(750);
  scrollWidth = vi
    .spyOn(HTMLElement.prototype, "scrollWidth", "get")
    .mockReturnValue(1000);
});
afterEach(() => {
  width.mockRestore();
  height.mockRestore();
  scrollHeight.mockRestore();
  scrollWidth.mockRestore();
});
const app = () =>
  render(
    <App>
      <DraftProvider>
        <ReportWorkspace project={{ id: "p" }} />
      </DraftProvider>
    </App>,
  );
it("selects at most four and guards report selections before refresh", async () => {
  app();
  await screen.findByRole("checkbox", { name: "1. Statement 1" });
  for (let i = 1; i <= 4; i++)
    fireEvent.click(
      screen.getByRole("checkbox", { name: `${i}. Statement ${i}` }),
    );
  expect(
    screen.getByRole("checkbox", { name: "5. Statement 5" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh report" }));
  expect(
    await screen.findByRole("dialog", { name: "Unsaved changes" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(loadReportSource).toHaveBeenCalledTimes(1);
  expect(
    screen
      .getAllByRole("checkbox")
      .filter(
        (input) =>
          input.checked &&
          input.getAttribute("aria-label") !==
            "Show changes since previous review",
      ).length,
  ).toBeGreaterThanOrEqual(4);
});
it("labels report-only edits without changing source data", async () => {
  app();
  await screen.findByRole("checkbox", { name: "1. Statement 1" });
  fireEvent.click(screen.getByText("Shorten text for this report"));
  fireEvent.change(screen.getByLabelText("Report excerpt: Customer promise"), {
    target: { value: "Short version" },
  });
  const sheet = screen.getByRole("article", { name: "One-page project brief" });
  expect(within(sheet).getByText("Short version")).toBeInTheDocument();
  expect(within(sheet).getAllByText(/excerpt/).length).toBeGreaterThan(0);
  expect(source.promises.customerPromise).toBe("Customer value");
});
it("blocks print on failed access verification", async () => {
  verifyReportAccess.mockRejectedValueOnce(new Error("removed"));
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  app();
  const button = await screen.findByRole("button", {
    name: "Print / Save as PDF",
  });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await screen.findByText(/Printing is blocked/);
  expect(print).not.toHaveBeenCalled();
  print.mockRestore();
});
it("blocks print on overflow without silently shortening the text", async () => {
  scrollHeight.mockReturnValue(1000);
  app();
  await screen.findByRole("checkbox", { name: "1. Statement 1" });
  await screen.findByText("Adjust the report before printing");
  expect(
    screen.getByRole("button", { name: "Print / Save as PDF" }),
  ).toBeDisabled();
  expect(screen.getByText("Customer value")).toBeInTheDocument();
});

it("prints the reviewed copy only after checking access", async () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => {
    expect(document.getElementById("project-brief-print")).toHaveTextContent(
      "Pilot",
    );
    expect(
      document.getElementById("project-brief-print"),
    ).not.toHaveTextContent("Refresh report");
  });
  app();
  const button = await screen.findByRole("button", {
    name: "Print / Save as PDF",
  });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(print).toHaveBeenCalledOnce());
  expect(verifyReportAccess).toHaveBeenCalledWith("p");
  expect(verifyReportAccess.mock.invocationCallOrder[0]).toBeLessThan(
    print.mock.invocationCallOrder[0],
  );
  print.mockRestore();
});

it("omits review comparison and keeps the full chart with current scores", async () => {
  app();
  await screen.findByRole("checkbox", { name: "1. Statement 1" });
  fireEvent.click(screen.getByRole("checkbox", { name: "1. Statement 1" }));
  expect(
    screen.queryByText("Changes since previous review"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("checkbox", {
      name: "Show changes since previous review",
    }),
  ).not.toBeInTheDocument();
  expect(loadReportComparison).not.toHaveBeenCalled();
  expect(screen.getByText("Consequence 80 | Evidence 20")).toBeInTheDocument();
  expect(screen.getByText("Chart: 5 assumptions")).toBeInTheDocument();
});
