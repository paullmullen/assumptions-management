import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
const state = vi.hoisted(() => ({
  changeProjects: null,
  user: { uid: "member", email: "member@example.org", emailVerified: true },
}));
vi.mock("./features/reviews/reviewPreference.js", () => ({
  watchReviewPreference: vi.fn((_id, callback) => {
    callback(true);
    return () => {};
  }),
  saveReviewPreference: vi.fn(),
}));
vi.mock("./firebase.js", () => ({
  auth: { currentUser: state.user },
  isFirebaseConfigured: true,
}));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn((_, callback) => {
    callback(state.user);
    return () => {};
  }),
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("./verification.js", () => ({
  refreshVerificationState: vi.fn().mockResolvedValue(true),
  sendVerificationEmail: vi.fn(),
  requestPasswordResetEmail: vi.fn(),
}));
vi.mock("./services.js", () => ({
  createProject: vi.fn(),
  ensureUserProfile: vi.fn(),
  loadProjects: vi.fn(),
  watchProjects: vi.fn((_, callback) => {
    state.changeProjects = callback;
    callback([{ id: "p", name: "Shared project", creatorId: "owner" }]);
    return () => {};
  }),
}));
vi.mock("./features/projectBrief/ProjectBriefCard.jsx", () => ({
  default: () => <div>Private project promises</div>,
}));
vi.mock("./features/assumptions/AssumptionsPanel.jsx", () => ({
  default: () => <div>Private assumptions</div>,
}));
vi.mock("./features/reviews/ReviewsPanel.jsx", () => ({
  default: () => <div>Private reviews</div>,
}));
vi.mock("./features/members/MembersPanel.jsx", () => ({
  default: () => <div>Owner access controls</div>,
}));
vi.mock("./features/members/InvitationScreen.jsx", () => ({
  default: ({ invitationId }) => <div>Invitation route: {invitationId}</div>,
}));
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});
describe("collaboration navigation", () => {
  it("preserves an invitation deep link even when the user already has one project", async () => {
    window.history.replaceState({}, "", "/invitations/invited");
    render(<App />);
    await screen.findByText("Invitation route: invited");
    expect(window.location.pathname).toBe("/invitations/invited");
    expect(screen.queryByText("Private assumptions")).not.toBeInTheDocument();
  });
  it("hides owner controls from members and closes project content on removal", async () => {
    window.history.replaceState({}, "", "/projects/p");
    render(<App />);
    await screen.findByText("Private assumptions");
    expect(screen.queryByText("Owner access controls")).not.toBeInTheDocument();
    act(() => state.changeProjects([]));
    await waitFor(() =>
      expect(screen.queryByText("Private assumptions")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Private reviews")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Private project promises"),
    ).not.toBeInTheDocument();
  });
});
