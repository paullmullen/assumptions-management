import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MembersPanel from "./MembersPanel.jsx";
import {
  inviteMember,
  loadInvitations,
  loadMembers,
  revokeInvitation,
} from "./memberService.js";
vi.mock("./memberService.js", () => ({
  inviteMember: vi.fn(),
  loadInvitations: vi.fn(),
  loadMembers: vi.fn(),
  revokeInvitation: vi.fn(),
  removeMember: vi.fn(),
}));
const user = { uid: "owner", email: "owner@example.org" };
const timestamp = {
  toMillis: () => Date.now() + 86400000,
  toDate: () => new Date(Date.now() + 86400000),
};
beforeEach(() => {
  vi.resetAllMocks();
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
  loadMembers.mockResolvedValue([]);
  loadInvitations.mockResolvedValue([]);
  inviteMember.mockResolvedValue("inv");
  revokeInvitation.mockResolvedValue();
});
describe("owner access controls", () => {
  it("creates an email-specific shareable link and supports revocation", async () => {
    render(<MembersPanel projectId="p" user={user} />);
    await screen.findByText("No invitations yet.");
    loadInvitations.mockResolvedValue([
      {
        id: "inv",
        recipientEmail: "member@example.org",
        status: "pending",
        expiresAt: timestamp,
      },
    ]);
    fireEvent.change(screen.getByLabelText("Invite by email"), {
      target: { value: "member@example.org" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));
    await screen.findByText(`${window.location.origin}/invitations/inv`);
    expect(inviteMember).toHaveBeenCalledWith(user, "p", "member@example.org");
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(revokeInvitation).toHaveBeenCalledWith("inv"));
  });
  it("retains the address after a failed invitation write", async () => {
    inviteMember.mockRejectedValue({ code: "permission-denied" });
    render(<MembersPanel projectId="p" user={user} />);
    fireEvent.change(screen.getByLabelText("Invite by email"), {
      target: { value: "member@example.org" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));
    await screen.findByText(/could not be saved/);
    expect(screen.getByLabelText("Invite by email")).toHaveValue(
      "member@example.org",
    );
  });
});
