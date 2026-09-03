import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { App } from "antd";
import GoogleAccountButton from "./GoogleAccountButton.jsx";
import DraftProvider from "./features/workspace/DraftProvider.jsx";
import { useDraft } from "./features/workspace/draftContext.js";
import { connectGoogleAccount } from "./googleAuth.js";
vi.mock("./googleAuth.js", () => ({
  connectGoogleAccount: vi.fn(),
  hasGoogleAccount: () => false,
}));
function DirtyEditor() {
  useDraft("Assumption", { dirty: true, discard: vi.fn(), save: vi.fn() });
  return <GoogleAccountButton user={{ uid: "existing" }} />;
}
it("keeps an unsaved draft when connecting Google is cancelled", async () => {
  render(
    <App>
      <DraftProvider>
        <DirtyEditor />
      </DraftProvider>
    </App>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Connect Google account" }),
  );
  expect(await screen.findByText("Unsaved changes")).toBeInTheDocument();
  expect(connectGoogleAccount).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(connectGoogleAccount).not.toHaveBeenCalled();
});
