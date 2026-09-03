# Project invitations and collaboration

## Delivered workflow

The project owner has a **Project access** card below the portfolio and reviews. Enter a person's email address, choose **Create invitation**, then copy and share the generated link. This release does not send invitation email automatically. The link is tied to that email; possession alone does not grant access.

The recipient opens the link, signs in (or creates and verifies an account), and chooses **Accept invitation**. The invitation route survives sign-in and is not replaced by the automatic single-project redirect. The recipient sees the inviter and intended email before acceptance; project names, promises, assumptions, and reviews remain private until membership exists. A wrong-account or unavailable-link response does not expose invitation details.

Acceptance adds the project to the recipient's projects. Members can work with promises, assumptions, insights, scores, next steps/help, and reviews under the existing content rules. They cannot administer membership. Content is saved in the same project for all members; existing portfolio screens are not live co-editing surfaces, so reload to see another person's content changes.

The owner can inspect active members and invitations, refresh the access list, revoke pending invitations, and remove a member after confirmation. Historical content keeps its original author identity. Removal ends future server-authorized reads and writes, and a membership subscription closes the removed project in the online application. Information already displayed or copied cannot be withdrawn.

Invitations last seven days in the normal UI. Expiry is enforced by server time even if a recipient changes their clock. Expired or revoked invitations cannot be accepted. Acceptance is idempotent for an already accepted invitation while the membership remains active. A removed member cannot reuse an accepted invitation or an outstanding invitation issued before removal; the owner must issue a new invitation to restore access. Pending invitations predating removal are shown as superseded in the owner list.

## Data and authorization

No new runtime dependencies, Cloud Functions, mail provider, or configuration values are required. The existing Firebase SDK submits writes and transactions; Firestore rules authorize them on the server. The historical backlog's proposed callable implementation is replaced for this bounded slice by equivalent server-enforced rules checks, not client-only checks.

- `projectInvitations/{id}`: project ID, normalized recipient email, inviter UID/email, creation/expiry timestamps, and status. Acceptance appends recipient UID/server time; revocation appends server time. Terminal records cannot be rewritten or deleted. No project name or description is copied into invitations.
- `users/{uid}/projectMemberships/{projectId}` remains the authoritative access boundary. Accepted memberships have role `member`, the invitation ID, and normalized verified email. The original owner's existing record needs no migration.
- `projects/{projectId}/members/{uid}` is an owner-readable roster of invited members. Rules require it to match the authoritative record in the same atomic acceptance/removal operation. The original owner is shown directly in the UI.
- `projects/{projectId}/memberRemovals/{id}` is an immutable removal event. It is committed atomically with both inactive membership records, preserving removal history even if a person is invited again.

Only a verified active owner can create/revoke invitations, list the roster, or remove members. The recipient must have a verified email matching the normalized invitation address. Rules require a pending, unexpired invitation, prevent self-granted roles and incomplete acceptance, and bind acceptance to the correct project. Membership removal requires a matching immutable event and roster update. The sole owner cannot be removed, demoted, or replaced through this slice.

Recipients read their invitation by its unguessable ID; they cannot browse project invitations or discover project metadata. Owners query invitations only for their project. There is no email-address account lookup or account-existence response. The existing authenticated owner/member security boundary applies to all project content.

The UI uses a seven-day expiration based on the creator's clock; rules permit at most eight days from server time to tolerate modest clock differences and reject past expirations. A severely wrong creator clock causes a visible creation failure. Recipient clock values never authorize acceptance.

## Deployment and acceptance

Deploy Hosting **and** Firestore rules:

```powershell
npm.cmd run deploy:development
```

No database migration is needed. Do not deploy only Hosting: old rules reject invitations and membership acceptance.

Manual checks using two browser profiles and two verified accounts:

1. As the owner, create an invitation for the second account and copy the link. Confirm the project access card explains that you must share the link.
2. Open it signed out in the second profile. Sign in or register/verify. Confirm the invitation remains the destination. A different signed-in email must not see invitation or project details.
3. Accept and verify the shared project opens. Add an assumption and an insight; publish a review. Reload the owner's project and verify those contributions and attribution.
4. Refresh the owner's access card to see the member. Confirm the member has no membership administration controls.
5. Revoke another pending invitation and verify it cannot be accepted. Verify an expired invitation does not offer acceptance.
6. Remove the member while their project is open. Confirm project content closes and further access fails. Verify prior insights and reviews remain attributed to them.
7. Try the old accepted link and any outstanding link issued before removal. Neither may restore access. Issue a fresh invitation and confirm it can restore access.
8. Verify the collaborator still cannot open another private project's URL or read its content.

Automated tests cover owner/recipient/nonmember boundaries, unverified access, expiration, revocation, atomic acceptance, role escalation, project isolation, shared content/review writes, removal and re-invitation, historical attribution, UI retry behavior, invitation deep links, and closing a removed project.

## Remaining backlog

This is a bounded invitation/shared-access slice, not completion of every original membership epic. Automatic invitation emails, invitation decline/inbox, multiple owners and ownership transfer remain future work. Guided setup, candidate lifecycle, notifications, and final pilot acceptance also remain. No ownership-transfer mechanism is silently implied by the existing `owner` role.
