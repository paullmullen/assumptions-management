import { fireEvent, render, screen } from "@testing-library/react";
import { ConfigProvider } from "antd";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import PortfolioChart from "./PortfolioChart.jsx";

const assumptions = [
  {
    id: "assessed-a",
    statement: "Customers will adopt the new workflow.",
    criticality: 82,
    evidence: 18,
  },
  {
    id: "assessed-b",
    statement: "The service can scale economically.",
    criticality: 56,
    evidence: 74,
  },
  {
    id: "unassessed",
    statement: "The team can support the launch.",
  },
];

function renderChart(items = assumptions) {
  function Harness() {
    const [selectedId, onSelect] = useState(null);
    return (
      <PortfolioChart
        assumptions={items}
        selectedId={selectedId}
        onSelect={onSelect}
        onSaveScores={() => {}}
      />
    );
  }
  return render(
    <ConfigProvider>
      <Harness />
    </ConfigProvider>,
  );
}

describe("portfolio chart", () => {
  it("plots only fully assessed assumptions and reports the unassessed count", () => {
    renderChart();

    expect(screen.getByText("1 not assessed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Assumption 1: Customers will adopt the new workflow/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /The team can support the launch/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("identifies the full assumption when a chart point is selected", () => {
    const { container } = renderChart();

    fireEvent.click(screen.getByRole("button", { name: /Assumption 1:/ }));

    expect(screen.getByText("Selected assumption")).toBeInTheDocument();
    expect(container.querySelector(".portfolio-selection")).toHaveTextContent(
      "Customers will adopt the new workflow.",
    );
    expect(
      screen.getByRole("spinbutton", { name: "Criticality if wrong" }),
    ).toHaveValue("82");
    expect(
      screen.getByRole("spinbutton", {
        name: "Strength of supporting evidence",
      }),
    ).toHaveValue("18");
  });

  it("teaches the next action when nothing has been assessed", () => {
    renderChart([assumptions[2]]);

    expect(
      screen.getByText("Assess an assumption to place it on the chart"),
    ).toBeInTheDocument();
  });
});
