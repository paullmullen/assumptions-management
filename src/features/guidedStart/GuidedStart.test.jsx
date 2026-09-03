import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import GuidedStart from "./GuidedStart.jsx";

beforeEach(() => localStorage.clear());

it("allows direct entry, pausing, and resuming without losing the guidance step", () => {
  const { unmount } = render(<GuidedStart projectId="a" userId="u" />);
  expect(
    screen.queryByRole("button", { name: "Next" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open guided start" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Pause guidance" }));
  unmount();
  render(<GuidedStart projectId="a" userId="u" />);
  fireEvent.click(screen.getByRole("button", { name: "Open guided start" }));
  expect(screen.getByRole("heading", { name: /2 of 5/ })).toBeInTheDocument();
});

it("keeps progress separate for different projects and accounts", () => {
  const { rerender } = render(<GuidedStart projectId="a" userId="u" />);
  fireEvent.click(screen.getByRole("button", { name: "Open guided start" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  rerender(<GuidedStart projectId="b" userId="u" />);
  fireEvent.click(screen.getByRole("button", { name: "Open guided start" }));
  expect(screen.getByRole("heading", { name: /1 of 5/ })).toBeInTheDocument();
  rerender(<GuidedStart projectId="a" userId="other" />);
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  rerender(<GuidedStart projectId="a" userId="u" />);
  expect(screen.getByRole("heading", { name: /2 of 5/ })).toBeInTheDocument();
});

it("focuses the existing editor and allows finishing and reopening guidance", () => {
  render(
    <>
      <GuidedStart projectId="a" userId="u" />
      <section id="project-promises" tabIndex={-1}>
        Editor
      </section>
    </>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open guided start" }));
  fireEvent.click(screen.getByRole("button", { name: "Go to promises" }));
  expect(screen.getByText("Editor")).toHaveFocus();
  for (let i = 0; i < 4; i++)
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Finish guidance" }));
  fireEvent.click(screen.getByRole("button", { name: "Open guided start" }));
  expect(screen.getByRole("heading", { name: /5 of 5/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(screen.getByRole("heading", { name: /4 of 5/ })).toBeInTheDocument();
});

it("ignores invalid stored progress and works when storage is blocked", () => {
  localStorage.setItem(
    "assumptions-guide:u:a",
    JSON.stringify({ open: true, step: 99 }),
  );
  render(<GuidedStart projectId="a" userId="u" />);
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("Blocked");
    });
  try {
    fireEvent.click(screen.getByRole("button", { name: "Open guided start" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: /2 of 5/ })).toBeInTheDocument();
  } finally {
    write.mockRestore();
  }
});
