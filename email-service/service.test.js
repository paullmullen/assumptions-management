// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { createAuthEmailService } from "./service.js";
import { renderAuthEmail } from "./templates.js";
import { createSmtp2goSender } from "./smtp2go.js";

const origin = "https://project.firebaseapp.com";
const link = (kind) =>
  `${origin}/__/auth/action?mode=${kind === "verify" ? "verifyEmail" : "resetPassword"}&oobCode=TEST-CODE&apiKey=TEST`;
let auth, store, send, service;
beforeEach(() => {
  auth = {
    getUser: vi
      .fn()
      .mockResolvedValue({ email: "tester@example.com", emailVerified: false }),
    getUserByEmail: vi.fn().mockResolvedValue({ email: "tester@example.com" }),
    generateEmailVerificationLink: vi.fn().mockResolvedValue(link("verify")),
    generatePasswordResetLink: vi.fn().mockResolvedValue(link("reset")),
  };
  store = {
    enqueue: vi.fn().mockResolvedValue(true),
    claim: vi.fn(),
    finish: vi.fn().mockResolvedValue(),
  };
  send = vi.fn().mockResolvedValue();
  service = createAuthEmailService({
    auth,
    store,
    send,
    appUrl: "https://project.web.app",
    actionOrigin: origin,
    rateSecret: "x".repeat(32),
    now: () => 100000,
  });
});
const context = { app: { appId: "trusted-app" }, ip: "192.0.2.1" };

it("queues verification for only the authenticated UID, with hashed quota identities", async () => {
  await expect(
    service.request({
      ...context,
      auth: { uid: "u1" },
      data: { kind: "verify" },
    }),
  ).resolves.toEqual({ accepted: true });
  const [job, quotas] = store.enqueue.mock.calls[0];
  expect(job).toMatchObject({ kind: "verify", uid: "u1", status: "pending" });
  expect(job.email).toBeUndefined();
  expect(quotas.map((q) => q.id)).toEqual(
    quotas.map(() => expect.stringMatching(/^[a-f0-9]{64}$/)),
  );
  expect(auth.getUser).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});
it.each([
  [{ data: { kind: "verify" } }, "unauthenticated"],
  [
    {
      auth: { uid: "u1" },
      data: { kind: "verify", email: "other@example.com" },
    },
    "unauthenticated",
  ],
  [{ data: { kind: "reset", email: "bad" } }, "invalid-argument"],
  [
    {
      data: {
        kind: "reset",
        email: "a@example.com",
        redirect: "https://evil.example",
      },
    },
    "invalid-argument",
  ],
  [
    { app: null, data: { kind: "reset", email: "a@example.com" } },
    "failed-precondition",
  ],
])(
  "rejects malformed or untrusted requests before any queue write",
  async (overrides, code) => {
    await expect(
      service.request({ ...context, ...overrides }),
    ).rejects.toMatchObject({ code });
    expect(store.enqueue).not.toHaveBeenCalled();
  },
);
it("gives the same queue acknowledgement without looking up either reset address", async () => {
  for (const email of ["known@example.com", "unknown@example.com"])
    await expect(
      service.request({ ...context, data: { kind: "reset", email } }),
    ).resolves.toEqual({ accepted: true });
  expect(auth.getUserByEmail).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});
it("enforces shared rate limits before accepting another request", async () => {
  store.enqueue.mockResolvedValue(false);
  await expect(
    service.request({
      ...context,
      data: { kind: "reset", email: "a@example.com" },
    }),
  ).rejects.toMatchObject({ code: "resource-exhausted" });
  expect(send).not.toHaveBeenCalled();
});
it("uses a fresh server account lookup, sends HTML and text, and never persists the action link", async () => {
  store.claim.mockResolvedValue({ id: "job", kind: "verify", uid: "u1" });
  await service.process("job");
  expect(auth.getUser).toHaveBeenCalledWith("u1");
  expect(auth.generateEmailVerificationLink).toHaveBeenCalledWith(
    "tester@example.com",
    { url: "https://project.web.app", handleCodeInApp: false },
  );
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({
      to: "tester@example.com",
      html: expect.stringContaining("Verify my email"),
      text: expect.stringContaining(link("verify")),
    }),
  );
  expect(store.finish).toHaveBeenCalledWith(
    "job",
    "accepted-by-provider",
    100000,
  );
  expect(JSON.stringify(store.finish.mock.calls)).not.toContain("TEST-CODE");
});
it.each([
  { disabled: true, email: "tester@example.com" },
  { emailVerified: true, email: "tester@example.com" },
])(
  "skips verification for disabled or already verified accounts",
  async (user) => {
    auth.getUser.mockResolvedValue(user);
    store.claim.mockResolvedValue({ kind: "verify", uid: "u1" });
    await service.process("job");
    expect(send).not.toHaveBeenCalled();
    expect(store.finish).toHaveBeenCalledWith("job", "skipped", 100000);
  },
);
it("silently completes a reset job for an unknown account", async () => {
  auth.getUserByEmail.mockRejectedValue({ code: "auth/user-not-found" });
  store.claim.mockResolvedValue({
    kind: "reset",
    email: "missing@example.com",
  });
  await service.process("job");
  expect(send).not.toHaveBeenCalled();
  expect(store.finish).toHaveBeenCalledWith("job", "skipped", 100000);
});
it("sends a reset link and records sanitized failure without retrying an ambiguous send", async () => {
  store.claim
    .mockResolvedValueOnce({ kind: "reset", email: "tester@example.com" })
    .mockResolvedValue(null);
  send.mockRejectedValue(new Error("private credential and link"));
  await service.process("job");
  await service.process("job");
  expect(auth.generatePasswordResetLink).toHaveBeenCalledOnce();
  expect(send).toHaveBeenCalledOnce();
  expect(store.finish).toHaveBeenCalledWith("job", "failed", 100000);
});
it("includes a real anchor button and fallback, and rejects a foreign action URL", () => {
  const result = renderAuthEmail("verify", link("verify"), origin);
  expect(result.html).toContain(
    'href="https://project.firebaseapp.com/__/auth/action?mode=verifyEmail&amp;oobCode=TEST-CODE&amp;apiKey=TEST"',
  );
  expect(result.text).toContain(link("verify"));
  expect(() =>
    renderAuthEmail(
      "verify",
      link("verify").replace(origin, "https://evil.example"),
      origin,
    ),
  ).toThrow();
  expect(() => renderAuthEmail("reset", link("verify"), origin)).toThrow();
});
it("checks provider acceptance instead of treating HTTP success as delivered", async () => {
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { succeeded: 0, failed: 1 } }),
  });
  const sender = createSmtp2goSender({
    apiKey: "secret",
    sender: "verified@example.com",
    fetchImpl,
  });
  await expect(
    sender({
      to: "tester@example.com",
      ...renderAuthEmail("reset", link("reset"), origin),
    }),
  ).rejects.toThrow("could not be confirmed");
  fetchImpl.mockResolvedValue({
    ok: true,
    json: async () => ({ data: { succeeded: 1, failed: 0 } }),
  });
  await expect(
    sender({
      to: "tester@example.com",
      ...renderAuthEmail("reset", link("reset"), origin),
    }),
  ).resolves.toBeUndefined();
  const payload = JSON.parse(fetchImpl.mock.calls[0][1].body);
  expect(payload.to).toEqual(["tester@example.com"]);
  expect(payload.html_body).toContain("Reset my password");
  expect(payload.text_body).toContain(link("reset"));
  expect(fetchImpl.mock.calls[0][1].headers["X-Smtp2go-Api-Key"]).toBe(
    "secret",
  );
});
