import { expect, it, vi } from "vitest";
import { httpsCallable } from "firebase/functions";
import { createAuthEmailClient } from "./authEmailClient.js";
vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn() }));
it("requests verification without a client-controlled recipient and resets with only the email", async () => {
  const invoke = vi.fn().mockResolvedValue({ data: { accepted: true } });
  httpsCallable.mockReturnValue(invoke);
  const client = createAuthEmailClient("functions");
  await client.sendVerificationEmail();
  await client.sendPasswordResetEmail("tester@example.com");
  expect(httpsCallable).toHaveBeenCalledWith("functions", "requestAuthEmail");
  expect(invoke.mock.calls).toEqual([
    [{ kind: "verify" }],
    [{ kind: "reset", email: "tester@example.com" }],
  ]);
});
it("does not report success when acceptance is absent or the endpoint fails", async () => {
  const invoke = vi.fn().mockResolvedValue({ data: {} });
  httpsCallable.mockReturnValue(invoke);
  const client = createAuthEmailClient("functions");
  await expect(client.sendVerificationEmail()).rejects.toThrow();
  invoke.mockRejectedValue({ code: "functions/resource-exhausted" });
  await expect(
    client.sendPasswordResetEmail("tester@example.com"),
  ).rejects.toMatchObject({ code: "functions/resource-exhausted" });
});
