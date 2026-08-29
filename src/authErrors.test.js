import { describe, expect, it } from "vitest";
import { authenticationErrorMessage } from "./authErrors.js";

describe("authenticationErrorMessage", () => {
  it.each([
    [
      "auth/email-already-in-use",
      "An account already exists for this email. Sign in or reset your password.",
    ],
    ["auth/invalid-credential", "Email or password is incorrect."],
    ["auth/invalid-email", "Enter a valid email address."],
    ["auth/weak-password", "Use a password with at least 8 characters."],
  ])("maps %s to a concise user-facing message", (code, expected) => {
    expect(authenticationErrorMessage({ code })).toBe(expected);
  });

  it("does not expose unknown Firebase errors", () => {
    expect(
      authenticationErrorMessage({
        code: "auth/internal-error",
        message: "raw Firebase detail",
      }),
    ).toBe(
      "We could not complete that request. Check the details and try again.",
    );
  });
});
