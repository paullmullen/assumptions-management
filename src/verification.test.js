import { describe, expect, it, vi } from "vitest";

const { sendEmailVerification } = vi.hoisted(() => ({
  sendEmailVerification: vi.fn(),
}));

vi.mock("firebase/auth", () => ({ sendEmailVerification }));

import {
  refreshVerificationState,
  sendVerificationEmail,
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
