import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App as AntApp } from "antd";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import ProjectBriefCard from "./ProjectBriefCard.jsx";
import { loadProjectBrief, saveProjectBrief } from "../../services.js";

vi.mock("../../services.js", () => ({
  loadProjectBrief: vi.fn(),
  saveProjectBrief: vi.fn(),
}));
const promises = {
  customerPromise: "Customer value",
  investorPromise: "Sustainable return",
  coworkerPromise: "Healthy work",
};
const customer = () =>
  screen.getByLabelText("What promise are you making to the customer?");
const app = (projectId = "a") => (
  <AntApp>
    <ProjectBriefCard projectId={projectId} userId="owner" />
  </AntApp>
);
let errors;
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});
beforeEach(() => {
  vi.clearAllMocks();
  errors = vi.spyOn(console, "error");
  saveProjectBrief.mockResolvedValue();
});
afterEach(() => errors.mockRestore());

it("keeps the form connected while loading and populates it without a useForm warning", async () => {
  let resolve;
  loadProjectBrief.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  render(app());
  expect(customer()).toBeDisabled();
  await act(async () => {
    resolve(promises);
  });
  await waitFor(() => expect(customer()).toHaveValue(promises.customerPromise));
  expect(customer()).toBeEnabled();
  // Flush the library's deferred disconnected-form warning.
  await act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
  expect(errors.mock.calls.flat().join(" ")).not.toMatch(
    /Instance created by.*useForm/,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save promises" }));
  await waitFor(() =>
    expect(saveProjectBrief).toHaveBeenCalledWith("a", "owner", promises),
  );
});

it("clears promises on project switch and ignores the previous project's late response", async () => {
  let resolveA;
  let resolveB;
  loadProjectBrief
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolveA = done;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolveB = done;
        }),
    );
  const { rerender } = render(app("a"));
  rerender(app("b"));
  expect(customer()).toHaveValue("");
  expect(customer()).toBeDisabled();
  await act(async () => resolveA(promises));
  expect(customer()).toHaveValue("");
  await act(async () =>
    resolveB({ ...promises, customerPromise: "Project B only" }),
  );
  await waitFor(() => expect(customer()).toHaveValue("Project B only"));
  fireEvent.click(screen.getByRole("button", { name: "Save promises" }));
  await waitFor(() =>
    expect(saveProjectBrief).toHaveBeenCalledWith("b", "owner", {
      ...promises,
      customerPromise: "Project B only",
    }),
  );
});
