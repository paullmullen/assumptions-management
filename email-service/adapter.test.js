// @vitest-environment node
import { expect, it, vi } from "vitest";
vi.mock("firebase-functions/v2/https", async (importOriginal) => ({
  ...(await importOriginal()),
  onCall: (options, handler) => ({ options, handler }),
}));
vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: (options, handler) => ({ options, handler }),
}));
import { requestAuthEmail, deliverAuthEmail } from "./index.js";
it("requires App Check on the production callable and binds a private queue worker", () => {
  expect(process.env.FUNCTIONS_EMULATOR).not.toBe("true");
  expect(requestAuthEmail.options.enforceAppCheck).toBe(true);
  expect(requestAuthEmail.options.secrets.map((item) => item.name)).toEqual([
    "SMTP2GO_API_KEY",
    "AUTH_EMAIL_RATE_SECRET",
  ]);
  expect(deliverAuthEmail.options.document).toBe("authEmailJobs/{jobId}");
  expect(deliverAuthEmail.options.retry).toBe(false);
});
