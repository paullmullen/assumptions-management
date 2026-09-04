# Candidate grouping board — first implementation

The approved grouping-board mockup is implemented as a bounded extension of the candidate workshop. No new dependency, whiteboard integration, live cursor, freeform canvas, or scoring model is introduced. This feature is ready for user review; real browser, touch, and visual acceptance remain pending.

## Workflow

Open Candidates. Board is the default; List shows the same candidate records. Existing candidates begin in Ungrouped without migration. Paste candidates into the existing one-per-line entry and save. Add group creates a named group shared by project members. In this first slice group names are fixed after creation, and groups cannot be deleted.

Drag a card onto a group to place it at the end, or onto another card to place it before that card. Move to, Up, and Down provide keyboard and touch alternatives. Successful moves persist group and order. Failed moves leave the local board unchanged. Refresh candidates to load teammates' changes; this is not simultaneous live whiteboard editing. New groups are sorted by name when loaded. Group membership does not change a candidate's wording or status.

Select two to eight pending candidates and choose Combine selected. Write the consolidated statement in the drawer. Saving creates one new pending candidate and marks all sources Combined in one transaction. It takes the first selected source in the workshop's loaded order as its placement. Sources may come from different groups. The combined candidate is placed in that source's group and at its prior rank. Original statement, author, time, and earlier source links remain preserved in the source documents, now read-only. Sources are not silently deleted. Source candidates expands the preserved lineage, including intermediate combinations. Show completed makes adopted and combined records visible. A combined candidate can itself be combined again. There is no undo/uncombine in this slice; review wording before saving.

Adopt into portfolio continues to use the existing scoring drawer and atomic scored adoption. Cancel does not adopt. The resulting active assumption retains sourceCandidateId pointing to the combined candidate; its source records remain inspectable under Candidates. Original combined-away candidates cannot be adopted independently. Removing adopted cards from the pending board also clears their selection.

Combined wording and group-name drafts participate in the existing save/discard/keep-editing navigation guard. Closing/Escape, source refresh, navigation, and project switching cannot silently discard them. Failed saves retain the draft. If selected wording/status changes remotely, combination fails without partial writes; cancel and refresh after preserving any wording you want to reuse. Selection checkboxes alone are presentation state, not saved edits. Ordinary candidate capture/wording behavior remains available in both views.

## Data and security

- New project subcollection candidateGroups stores name and creation attribution; verified active members can create/read groups. Names are limited to 80 characters.
- Candidate groupId/rank persist layout. Legacy records without those fields remain valid.
- Combined candidates carry immutable sourceCandidateIds (2–8 distinct IDs).
- Sources transition pending → combined with combinedInto, combinedBy, and combinedAt. Rules require matching creation of the target and matching source transitions in the same atomic request. Sources must belong to this project; creation cannot fabricate combined-away records.
- Preserved sources cannot be edited/deleted. Adopted candidates and active assumption provenance remain protected by the existing rules.
- Services use transactions with expected source wording/status, idempotent combination IDs, and position checks. Competing combinations can produce only one winner. Movement normalizes destination order to spaced ranks, handling tied legacy timestamps. Stale moves fail; retries that already match the requested order are safe. New concurrent cards are not removed; refresh to reconcile their placement. A move affecting over 450 cards is blocked before writing; split unusually large groups.
- No ownership, invitation, support, or global-admin permissions change.

## Deployment

Deploy **Hosting and Firestore rules together** and refresh open tabs. The updated app needs the new group and combination rules. No migration, Functions deployment, or environment change is required.

```powershell
npm.cmd ci
npm.cmd run build
npx.cmd firebase deploy --only hosting,firestore:rules --project assumptions-management
```

Nothing was deployed during implementation. Do not roll back to an older client after combining candidates without reviewing compatibility: older clients do not understand the combined state. Keep these rules and this client together. Existing data remains preserved; a Hosting rollback is not a data rollback.

## Acceptance checks

1. Start with existing candidates. Verify Ungrouped, create two groups, move and reorder by drag and by keyboard controls; refresh and confirm placement. Test a phone using Move to and Up/Down.
2. Combine cards from one group and across groups. Verify pending count, placement, retained source wording/authors, and nested source history after a second combination.
3. Try Cancel, Escape, navigation, refresh, and project switching with draft wording. Test failed saves and confirm drafts remain.
4. Use two browser profiles to edit/adopt/combine the same selected source, then attempt the stale combination. Verify only one result and no partial retirement.
5. Adopt a combined candidate with explicit scores, including zero. Confirm portfolio provenance and inspect completed candidates. Verify the existing unsaved-adoption switching workflow.
6. Confirm an ordinary member can organize the shared project, an outsider cannot read groups or combine sources, and removed-member access stops. Test group load failure: it must not show a partial board as complete.
7. Review desktop/phone layout, long statements, visible focus, drawer focus return, drag placement and keyboard order. Browser service previously blocked local preview, so automated checks do not substitute for these visual checks.

## Verification result

136 application tests and 84 Firestore rules/service tests passed. Formatting, lint, and production build passed. Tests cover combination failure/draft retention, guarded close, source attribution, group creation, list switching, failed and successful keyboard movement, atomic eight-source combinations, idempotent retries, competing combinations, nested provenance, stale movement, protected adopted/combined records, forged links, and outsider/removed-member access. Real browser drag/touch, focus, and visual acceptance remain pending. No new production dependency was added and nothing was deployed.
