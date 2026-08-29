import { render, screen } from "@testing-library/react";
import { ConfigProvider } from "antd";
import { describe, expect, it } from "vitest";

function ActiveProjectHeader({ projectName }) {
  return <header>Active project: {projectName}</header>;
}

describe("active project header", () => {
  it("makes the active project unmistakable", () => {
    render(
      <ConfigProvider>
        <ActiveProjectHeader projectName="North Star" />
      </ConfigProvider>,
    );
    expect(screen.getByText("Active project: North Star")).toBeInTheDocument();
  });
});
