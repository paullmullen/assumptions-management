import { beforeEach, expect, it, vi } from "vitest";
import { linkWithPopup, signInWithPopup } from "firebase/auth";
import { auth } from "./firebase.js";
import { connectGoogleAccount, continueWithGoogle } from "./googleAuth.js";
vi.mock("./firebase.js", () => ({ auth: { currentUser: null } }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {
    setCustomParameters(parameters) {
      this.parameters = parameters;
    }
  },
  linkWithPopup: vi.fn(),
  signInWithPopup: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
it("opens an account chooser without restricting the user's email", async () => {
  await continueWithGoogle();
  expect(signInWithPopup).toHaveBeenCalledWith(
    auth,
    expect.objectContaining({ parameters: { prompt: "select_account" } }),
  );
});
it("connects to the current UID and refreshes verification claims", async () => {
  const user = { uid: "existing-owner", reload: vi.fn(), getIdToken: vi.fn() };
  linkWithPopup.mockResolvedValue({ user });
  expect(await connectGoogleAccount(user)).toBe(user);
  expect(linkWithPopup).toHaveBeenCalledWith(user, expect.anything());
  expect(user.reload).toHaveBeenCalledOnce();
  expect(user.getIdToken).toHaveBeenCalledWith(true);
  expect(signInWithPopup).not.toHaveBeenCalled();
});
it("never switches accounts when linking fails", async () => {
  const error = { code: "auth/credential-already-in-use" };
  linkWithPopup.mockRejectedValue(error);
  await expect(connectGoogleAccount({ uid: "original" })).rejects.toBe(error);
  expect(signInWithPopup).not.toHaveBeenCalled();
});
