# Slice 2A — Optional formal reviews

## Delivered behavior

New projects offer **Use formal reviews**, unchecked by default. The project owner can reverse this choice in **Settings & access** using an immediately saved switch. Members see the current preference but cannot change it. Existing projects without a preference retain reviews enabled; no migration is required.

When disabled, the Reviews tab becomes **Review history**. Published snapshots remain readable and immutable. New review and refresh/publication actions are unavailable; ordinary assumptions, scoring, insights, candidates, and history continue unchanged. Guidance directs users back to the portfolio rather than suggesting a new review. Reporting remains a later slice and will support either mode.

The preference is subscribed to while the project is open. If another tab turns reviews off, any open review draft and its notes remain in place, but cannot be published. Re-enabling reviews restores publication. Failed preference loads block new review actions and offer retry. Failed writes display an error; navigation is protected while a setting save is pending.

## Data and security

The project document stores a boolean `formalReviewsEnabled`. Absence means enabled for compatibility. Only an active owner may update this field, with server timestamp `reviewPreferenceUpdatedAt` and actor `reviewPreferenceUpdatedBy`. Name, creator, creation time, and other project metadata remain protected.

Capture checks current server state. Publication checks the preference inside its transaction; Firestore rules independently reject review creation when reviews are off, including a write batch that also disables reviews. Reads and immutable historical snapshots retain their existing membership checks. A retry confirming a previously committed publication remains idempotent even after reviews are turned off; it does not create another snapshot.

## Verification and deployment

Application checks cover owner/member controls, preference-save failure, hidden creation actions, and retained draft notes with blocked publication when the setting changes. Emulator tests cover new-project defaults and explicit choices, legacy compatibility, owner restrictions and immutable metadata, disabled capture/publication, continued insight recording, preserved history, re-enabling reviews, and same-batch enforcement.

Run `npm run check` and `npm run test:rules`. Verification: 71 application tests and 66 Firestore rules/service tests passed, along with formatting, lint, and the production build.

**Deploy Hosting and Firestore rules together**, using `npm.cmd run deploy:development` on Windows or `npm run deploy:development` elsewhere. This command builds and deploys to the configured Firebase project. No functions, dependencies, or configuration changes are required. Nothing was deployed by this task.

## Manual acceptance still required

1. Create one project with reviews off and one with reviews on. Verify their respective Review history/Reviews tabs.
2. Open an older project and confirm reviews remain enabled.
3. As owner, toggle the preference in Settings & access; reload and confirm persistence. As member, confirm the switch cannot be changed.
4. Publish a snapshot, then turn reviews off. Reopen the prior snapshot and add an ordinary insight without changing scores.
5. Keep a draft with notes open in a second tab. Disable reviews as owner. Confirm the draft remains, Publish/Refresh are disabled, and re-enabling permits publication.
6. Check Settings & access, review history, and the creation choice at desktop and phone widths. Browser visual acceptance was not performed for this slice.

Next: **2B — Score during candidate adoption**. Broader lifecycle and Miro discovery remain deferred.

## Follow-up fix

See [2A fix](Workspace-Slice-2A-Fix.md) for the Modal deprecation correction, persistent save errors, acknowledged preference updates, and rule-deployment troubleshooting.
