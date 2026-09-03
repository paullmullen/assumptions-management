import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  verify: vi.fn(),
  reset: vi.fn(),
  custom: false,
  configured: true,
}));
const { sendEmailVerification } = mocks;
vi.mock("./firebase.js", () => ({
  auth: "auth",
  functions: "functions",
  get customAuthEmailEnabled() {
    return mocks.custom;
  },
  get authEmailConfigured() {
    return mocks.configured;
  },
}));
vi.mock("./authEmailClient.js", () => ({
  createAuthEmailClient: () => ({
    sendVerificationEmail: mocks.verify,
    sendPasswordResetEmail: mocks.reset,
  }),
}));

vi.mock("firebase/auth", () => ({
  sendEmailVerification: mocks.sendEmailVerification,
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
}));

import {
  refreshVerificationState,
  sendVerificationEmail,
  requestPasswordResetEmail,
} from "./verification.js";

describe("email verification", () => {
  it("uses Firebase's default verification email action", async () => {
    const user = { uid: "user-a" };
    sendEmailVerification.mockResolvedValueOnce();

    await sendVerificationEmail(user);

    expect(sendEmailVerification).toHaveBeenCalledWith(user);
  });

  it("forces a refreshed ID token after verification", async () => {
    const user = {
      emailVerified: true,
      getIdToken: vi.fn().mockResolvedValue("fresh-token"),
      reload: vi.fn().mockResolvedValue(),
    };

    await expect(refreshVerificationState(user)).resolves.toBe(true);
    expect(user.reload).toHaveBeenCalledOnce();
    expect(user.getIdToken).toHaveBeenCalledWith(true);
  });

  it("does not refresh an ID token for an unverified user", async () => {
    const user = {
      emailVerified: false,
      getIdToken: vi.fn(),
      reload: vi.fn().mockResolvedValue(),
    };

    await expect(refreshVerificationState(user)).resolves.toBe(false);
    expect(user.getIdToken).not.toHaveBeenCalled();
  });
});

it("routes custom verification/reset through the callable without native fallback", async () => {
  mocks.custom = true;
  mocks.configured = true;
  mocks.sendEmailVerification.mockClear();
  mocks.verify.mockRejectedValueOnce({ code: "functions/unavailable" });
  await expect(sendVerificationEmail({ uid: "u" })).rejects.toMatchObject({
    code: "functions/unavailable",
  });
  expect(mocks.sendEmailVerification).not.toHaveBeenCalled();
  mocks.reset.mockResolvedValue();
  await requestPasswordResetEmail("tester@example.com");
  expect(mocks.reset).toHaveBeenCalledWith("tester@example.com");
  mocks.configured = false;
  expect(() => sendVerificationEmail({ uid: "u" })).toThrow();
  mocks.custom = false;
  mocks.configured = true;
});
