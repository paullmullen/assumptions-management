import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { continueWithGoogle } from "./googleAuth.js";
import { ensureUserProfile, watchProjects } from "./services.js";
const state = vi.hoisted(() => ({ user: null, callback: null }));
vi.mock("./firebase.js", () => ({
  auth: {
    get currentUser() {
      return state.user;
    },
  },
  isFirebaseConfigured: true,
}));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn((_, callback) => {
    state.callback = callback;
    callback(state.user);
    return () => {};
  }),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("./googleAuth.js", () => ({
  continueWithGoogle: vi.fn(),
  connectGoogleAccount: vi.fn(),
  hasGoogleAccount: (user) =>
    user?.providerData?.some((p) => p.providerId === "google.com"),
}));
vi.mock("./verification.js", () => ({
  refreshVerificationState: vi.fn(async (user) => user.emailVerified),
  sendVerificationEmail: vi.fn(),
  requestPasswordResetEmail: vi.fn(),
}));
vi.mock("./services.js", () => ({
  ensureUserProfile: vi.fn(),
  watchProjects: vi.fn((_, callback) => {
    callback([]);
    return () => {};
  }),
  createProject: vi.fn(),
  loadProjects: vi.fn(),
}));
beforeEach(() => {
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
  state.user = null;
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});
it("offers Google first, keeps email sign-in, and uses the updated contact", async () => {
  render(<App />);
  const button = await screen.findByRole("button", {
    name: "Continue with Google",
  });
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Contact Paul" })).toHaveAttribute(
    "href",
    "mailto:mullenpaull@gmail.com",
  );
  fireEvent.click(button);
  await waitFor(() => expect(continueWithGoogle).toHaveBeenCalledOnce());
});
it("shows a recoverable popup error without leaving sign-in", async () => {
  continueWithGoogle.mockRejectedValueOnce({ code: "auth/popup-blocked" });
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Continue with Google" }),
  );
  expect(await screen.findByText(/Allow pop-ups/)).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
});
it("loads a verified Google user's profile and projects without a verification email", async () => {
  state.user = {
    uid: "google-user",
    emailVerified: true,
    providerData: [{ providerId: "google.com" }],
  };
  render(<App />);
  await screen.findByRole("button", { name: "Sign out" });
  expect(ensureUserProfile).toHaveBeenCalledWith(state.user);
  expect(watchProjects).toHaveBeenCalledWith(
    state.user,
    expect.any(Function),
    expect.any(Function),
  );
  expect(screen.queryByText("Verify your email")).not.toBeInTheDocument();
});
it("still gates an unverified account", async () => {
  state.user = { uid: "unverified", emailVerified: false };
  render(<App />);
  await screen.findByText("Verify your email");
  expect(watchProjects).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Connect Google account" }),
  ).toBeInTheDocument();
});
