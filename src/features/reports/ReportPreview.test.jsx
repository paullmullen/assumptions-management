import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ReportPreview from "./ReportPreview.jsx";
import { reportFitMessage } from "./reportValues.js";
vi.mock("../portfolioChart/PortfolioChart.jsx", () => ({
  default: ({ movement = [] }) => (
    <div>Chart: {movement.filter((row) => row.changed).length} arrows</div>
  ),
}));
const source = {
  kind: "current",
  projectName: "Pilot",
  promises: {},
  assumptions: Array.from({ length: 6 }, (_, i) => ({
    id: String(i),
    statement: `Assumption name ${i + 1}`,
    ...(i < 5 ? { criticality: 70, evidence: 20 } : {}),
  })),
};
it("names every assumption with no discussion selection and marks unassessed entries", () => {
  render(
    <ReportPreview
      source={source}
      selected={[]}
      overrides={{}}
      generatedAt={1000}
    />,
  );
  const legend = within(
    screen.getByRole("region", { name: "Assumption legend" }),
  );
  expect(legend.getAllByRole("listitem")).toHaveLength(6);
  source.assumptions.forEach((row) =>
    expect(legend.getByText(row.statement, { exact: false })).toBeTruthy(),
  );
  expect(legend.getByText(/Not assessed/)).toBeTruthy();
  expect(screen.getByText("No discussion items selected.")).toBeTruthy();
});
it("marks four discussion items and shows excerpts for unselected legend names", () => {
  render(
    <ReportPreview
      source={source}
      selected={["0", "1", "2", "3"]}
      overrides={{ "5:statement": "Short sixth name" }}
      generatedAt={1000}
    />,
  );
  const legend = within(
    screen.getByRole("region", { name: "Assumption legend" }),
  );
  expect(legend.getAllByLabelText("Selected for discussion")).toHaveLength(4);
  expect(legend.getByText("Short sixth name", { exact: false })).toBeTruthy();
  expect(legend.getByText("(excerpt)")).toBeTruthy();
});
it("does not blame selection for chart or legend overflow", () => {
  expect(reportFitMessage(["Portfolio chart"], 0)).not.toMatch(/select fewer/i);
  expect(reportFitMessage(["Assumption legend"], 4)).toMatch(
    /every assumption remains/,
  );
  expect(reportFitMessage(["Assumption legend"], 4)).not.toMatch(
    /select fewer/i,
  );
  expect(reportFitMessage(["Selected assumptions"], 4)).toMatch(
    /select fewer/i,
  );
});
it("identifies the editable header field and places the legend below the chart", () => {
  const { container } = render(
    <ReportPreview
      source={source}
      selected={[]}
      overrides={{}}
      generatedAt={1000}
    />,
  );
  expect(
    container
      .querySelector(".report-portfolio")
      .children[1].getAttribute("aria-label"),
  ).toBe("Assumption legend");
  expect(container.querySelector('[data-fit="Project name"]')).toBeTruthy();
  expect(container.querySelector('[data-fit="Header"]')).toBeNull();
  expect(reportFitMessage(["Project name"], 0)).toContain(
    "shorten “Project name”",
  );
  expect(reportFitMessage(["Report source and review title"], 0)).toContain(
    "shorten “Review title”",
  );
});

it("passes movement for unselected assumptions and removes it when disabled", () => {
  const baseline = {
    capturedAt: 1000,
    assumptions: [{ ...source.assumptions[0], evidence: 80 }],
  };
  const { rerender } = render(
    <ReportPreview
      source={source}
      selected={[]}
      overrides={{}}
      movementReview={baseline}
    />,
  );
  expect(screen.getByText("Chart: 1 arrows")).toBeTruthy();
  expect(screen.getByText(/Outline: previous position/)).toBeTruthy();
  rerender(<ReportPreview source={source} selected={[]} overrides={{}} />);
  expect(screen.getByText("Chart: 0 arrows")).toBeTruthy();
  expect(screen.queryByText(/Outline: previous position/)).toBeNull();
});
