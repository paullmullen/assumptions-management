# Slice 1B — Unified assumption drawer

September 3, 2026. Implements the next bounded slice of the approved [workspace design](Workspace-Design.md).

**Deployment: update both Hosting and Firestore rules.** Initial assumptions can now include scores, an insight, next step, and help needed in a single transaction. Older rules do not permit all these initial fields and history records. The existing development deployment command deploys both. No deployment was performed for this delivery.

## Delivered behavior

- Clicking a chart point or the sole list row opens the same right-side drawer. Wording, both scores, an optional insight/source/classification, next step, and help needed are immediately editable. The old list wording controls and below-chart editor are removed.
- One **Save changes** action commits all changed assumption fields and the corresponding insight/score/management history atomically. The drawer stays open. Insight-only and management-only changes still work with unassessed scores. Zero is valid; changing scores requires a valid pair of whole numbers from 0–100.
- The chart/list show saved state. Draft changes do not move a point before persistence succeeds.
- **Add assumption** uses the same drawer, with optional initial scores and supporting fields. The assumption and any initial history save atomically; a stable ID is retained for retries, preventing a retry from creating another assumption. Blank wording/partial scores cannot be saved. Candidate adoption remains unscored and opens the adopted assumption's drawer; required adoption scoring remains Goal 2B.
- Existing attributed insight and from/to score/management history appears under an expandable History section. Source links, classification, retry behavior, scoring guidance, and the nonblocking criticality reminder are preserved.
- Close/Escape, selection changes, project navigation, sign-out, and browser Back/Forward use the shared draft guard. Save failures retain values and block pending navigation. Revert requires explicit confirmation. Reopening the selected row never resets its open draft. Closing retains selection and restores focus to its row/point when available.
- At 1440 px and above, the 520 px drawer is nonmodal, reserves workspace space, and permits chart/list selection. Below that width it overlays the workspace with a mask and keyboard focus containment; on a phone it fills the width. Its header and save footer remain separate from its scrollable body. Opening focuses the heading, not a text input.

## Concurrent editing

The save transaction compares the edited baseline with current saved values. It checks fields being changed, both scores when editing the score pair, and wording for every save because wording is context for an insight. A conflicting transaction commits nothing and returns current values for review. Unrelated concurrent field changes are preserved.

The drawer shows latest saved values beside the draft. **Keep my edits against these values** acknowledges that comparison and updates the baseline while retaining the user's changed fields and insight; untouched fields take the current saved values. This does not save. The user reviews the form and chooses Save changes again. Revert can instead restore the latest conflict values. A further intervening change is checked again on save.

This is optimistic conflict protection for the drawer's save path, not a new live collaboration subscription or a replacement for active-membership security. Existing legacy service entry points remain available. No new permission or production dependency was added.

## Data and security

- `saveAssumptionDraft` performs current-state reads and all writes in one Firestore transaction; rejected or conflicting writes do not partially update wording or create history.
- Initial score and management history uses empty before-values (null scores, empty next-step/help). Rules validate those values against the newly created parent, the corresponding history pointers, actor, and server time.
- Insight creation can reference a parent created in the same atomic operation. Arbitrary orphan insights and forged before/after history remain rejected.
- Candidate provenance, immutable creator fields, member-only access, and append-only history remain enforced.
- Wording-only updates do not fabricate an insight or complete wording history. Immutable wording/promise history remains Goal 3A. Existing records are not backfilled.
- Drafts remain in memory; the browser unload warning is not crash recovery or offline persistence.

## Verification

- Application tests: **16 files, 63 tests passed**.
- Firestore rules and service integration: **62 tests passed**, including simultaneous competing saves.
- Formatting, lint, and production build: passed.
- No new production dependency. Existing large-bundle and jsdom pseudo-element measurement warnings remain; no assertions fail.

Coverage includes combined edits, insight-only/unassessed saves, initial zero scores and history, invalid/forged/outside writes, competing transactions, stale wording, untouched concurrent fields, no-op history, close/Escape, explicit discard/revert, failed save/retry, same-row selection, creation followed by continued editing, history errors, in-flight saves, project unmount, and modal/nonmodal semantics.

The browser service could not access the local preview in this environment during 1A. No new browser visual acceptance is claimed for 1B. Desktop/mobile appearance, actual keyboard trapping across screen sizes, and the full development multi-account journey still need review in the development app. The existing large-bundle warning remains.

## Development acceptance

1. Deploy Hosting and Firestore rules together to the development project.
2. Select a point, change wording/scores/insight/next steps, and save once. Confirm saved values, one combined history record for the score/management/insight, and the chart's updated point. Save an insight alone on an unassessed item.
3. Start a new assumption with optional fields. Save, then add another insight without closing. Confirm only one assumption was created. Try invalid input and a failed save.
4. Edit the same assumption in two sessions. Save in one, then try saving the other's stale edit. Verify the conflict comparison, retained draft, explicit review/rebase, and no partial history.
5. Exercise Close, Escape, changing selection, changing project, sign-out, and Back/Forward with dirty fields. Verify Keep editing, Save and continue, failed-save recovery, explicit discard, and focus return.
6. Inspect a wide desktop, an intermediate window, and a phone width: header/footer visibility, form scrolling, list selection, overlay focus behavior, and readable long statements/history. Verify removed-member access still closes private content.

## Next

**1C — Portfolio sorting:** consequence, evidence, recent change, and attention priority. Agree on the attention-priority rule before implementing it. Recent change must include insight/content changes, not just score updates. Candidate merge/split and the lower-priority Miro discovery remain deferred.
