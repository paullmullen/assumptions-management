import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(async () => {
  cleanup();
  // Ant Design's form-validation debounce schedules a 10 ms callback without
  // cancellation on unmount. Let it settle before jsdom tears down window.
  await new Promise((done) => setTimeout(done, 20));
});

// jsdom does not provide the browser observer used by Ant Design textareas.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
