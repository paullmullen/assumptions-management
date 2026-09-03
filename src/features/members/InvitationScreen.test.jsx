import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InvitationScreen from "./InvitationScreen.jsx";
import { loadInvitation, acceptInvitation } from "./memberService.js";
vi.mock("./memberService.js", () => ({
  loadInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
}));
const timestamp = (milliseconds) => ({
  toMillis: () => milliseconds,
  toDate: () => new Date(milliseconds),
});
const invite = {
  projectId: "secret-project",
  recipientEmail: "member@example.org",
  inviterEmail: "owner@example.org",
  status: "pending",
  expiresAt: timestamp(Date.now() + 86400000),
};
const user = { uid: "member", email: "member@example.org" };
beforeEach(() => {
  vi.resetAllMocks();
  loadInvitation.mockResolvedValue(invite);
  acceptInvitation.mockResolvedValue("secret-project");
});
describe("invitation acceptance", () => {
  it("shows only inviter and recipient before acceptance, then opens the authorized project", async () => {
    const onAccepted = vi.fn().mockResolvedValue();
    render(
      <InvitationScreen
        invitationId="inv"
        user={user}
        onAccepted={onAccepted}
        onBack={() => {}}
      />,
    );
    const accept = await screen.findByRole("button", {
      name: "Accept invitation",
    });
    expect(screen.queryByText("secret-project")).not.toBeInTheDocument();
    fireEvent.click(accept);
    await waitFor(() =>
      expect(onAccepted).toHaveBeenCalledWith("secret-project"),
    );
    expect(acceptInvitation).toHaveBeenCalledWith(user, "inv");
  });
  it("does not offer acceptance for expired or revoked invitations", async () => {
    loadInvitation.mockResolvedValue({ ...invite, expiresAt: timestamp(1) });
    const view = render(
      <InvitationScreen
        invitationId="inv"
        user={user}
        onAccepted={vi.fn()}
        onBack={() => {}}
      />,
    );
    await screen.findByText(/This invitation has expired/);
    expect(
      screen.queryByRole("button", { name: "Accept invitation" }),
    ).not.toBeInTheDocument();
    view.unmount();
    loadInvitation.mockResolvedValue({ ...invite, status: "revoked" });
    render(
      <InvitationScreen
        invitationId="revoked"
        user={user}
        onAccepted={vi.fn()}
        onBack={() => {}}
      />,
    );
    await screen.findByText("Invitation revoked.");
    expect(
      screen.queryByRole("button", { name: "Accept invitation" }),
    ).not.toBeInTheDocument();
  });
  it("keeps unauthorized invitation details hidden", async () => {
    loadInvitation.mockRejectedValue({ code: "permission-denied" });
    render(
      <InvitationScreen
        invitationId="inv"
        user={user}
        onAccepted={vi.fn()}
        onBack={() => {}}
      />,
    );
    await screen.findByText(/unavailable to this account/);
    expect(screen.queryByText(/owner@example.org/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Accept invitation" }),
    ).not.toBeInTheDocument();
  });
  it("retries opening after successful acceptance without accepting twice", async () => {
    const onAccepted = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue();
    render(
      <InvitationScreen
        invitationId="inv"
        user={user}
        onAccepted={onAccepted}
        onBack={() => {}}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Accept invitation" }),
    );
    await screen.findByText(/Invitation accepted, but/);
    fireEvent.click(screen.getByRole("button", { name: "Open project" }));
    await waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(2));
    expect(acceptInvitation).toHaveBeenCalledTimes(1);
  });
});
