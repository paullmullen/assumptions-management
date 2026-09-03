import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import { App as AntApp } from "antd";
import { useState } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import DraftProvider from "./DraftProvider.jsx";
import { useDraft } from "./draftContext.js";
import useProjectNavigation from "./useProjectNavigation.js";
function Harness() {
  const [path, navigate] = useProjectNavigation();
  const [text, setText] = useState("");
  useDraft("Project draft", {
    dirty: Boolean(text),
    save: async () => {
      setText("");
      return true;
    },
    discard: () => setText(""),
  });
  return (
    <>
      <p>{path}</p>
      <label>
        Draft
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <button onClick={() => navigate("/projects/b")}>Project B</button>
      <button onClick={() => navigate("/projects/c")}>Project C</button>
    </>
  );
}
beforeEach(() => {
  window.history.replaceState({ workspaceIndex: 0 }, "", "/projects/a");
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});
it("guards project switching, browser back/forward and browser unload without dropping drafts", async () => {
  render(
    <AntApp>
      <DraftProvider>
        <Harness />
      </DraftProvider>
    </AntApp>,
  );
  fireEvent.change(screen.getByLabelText("Draft"), {
    target: { value: "Unsaved" },
  });
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByText("Project B"));
  expect(window.location.pathname).toBe("/projects/a");
  fireEvent.click(screen.getByText("Save and continue"));
  await screen.findByText("/projects/b");
  expect(screen.getByLabelText("Draft")).toHaveValue("");
  fireEvent.click(screen.getByText("Project C"));
  await screen.findByText("/projects/c");
  fireEvent.change(screen.getByLabelText("Draft"), {
    target: { value: "Keep this" },
  });
  act(() => window.history.back());
  await screen.findByRole("dialog", { name: "Unsaved changes" });
  await waitFor(() => expect(window.location.pathname).toBe("/projects/c"));
  fireEvent.click(screen.getByText("Keep editing"));
  expect(screen.getByText("/projects/c")).toBeInTheDocument();
  expect(screen.getByLabelText("Draft")).toHaveValue("Keep this");
  act(() => window.history.back());
  await screen.findByRole("dialog", { name: "Unsaved changes" });
  fireEvent.click(screen.getByText("Discard changes"));
  await screen.findByText("/projects/b");
  expect(window.location.pathname).toBe("/projects/b");
  act(() => window.history.forward());
  await screen.findByText("/projects/c");
  expect(screen.getByLabelText("Draft")).toHaveValue("");
});
