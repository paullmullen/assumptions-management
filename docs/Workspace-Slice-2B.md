# Slice 2B — Score during candidate adoption

## Workflow

In **Candidates**, select **Adopt into portfolio**. This opens the same right-side assumption drawer used for normal editing, with candidate wording and two blank score fields. Enter both whole-number scores from 0–100 and choose **Adopt with scores**. Zero is valid; missing scores are not replaced with defaults.

The wording is read-only while scoring. Close the drawer and use **Edit candidate** if you want to refine it first. Optional initial insights, source/classification, next step, and help needed can be included in the same save.

Opening the drawer performs no write. Closing it without edits leaves the candidate pending. Closing or navigating with edits uses the existing Save and continue / Discard changes / Keep editing protection; an incomplete score pair cannot be saved. Successful adoption selects the scored assumption in the portfolio and removes the candidate from the pending list. Switching to another candidate protects the draft and keeps the next drawer visible.

Directly created or older unassessed assumptions retain their existing behavior; no migration or invented scores are introduced. Candidate capture still requires no scores. Both review preference modes work.

## Integrity and concurrency

Adoption uses the shared atomic drawer-save transaction to:

1. Check that the candidate is still pending with the reviewed wording.
2. Create the active assumption at the candidate's ID, with both scores and immutable candidate provenance.
3. Record initial scores from “Not assessed” to the entered values, plus any insight/management fields, with actor, email, and server time.
4. Mark the candidate adopted, including adopter/time and immutable `adoptionInsightId`.

Firestore rules require the scored assumption and matching history together. They reject direct unscored adoption, incomplete writes, invalid scores, forged attribution, and unauthorized users. Subsequent active-assumption edits cannot change its origin.

If another member changes wording, the drawer retains scores and notes and displays the latest wording. **Use latest candidate wording** updates the read-only statement; the user reviews the scores and saves explicitly. A competing adoption produces a visible error without overwriting the winner's values or discarding the losing draft.

Each drawer has a stable request ID. Retrying the same confirmed content after an uncertain response returns the existing adoption without duplicate history. Reusing the request with changed scores/notes is not treated as success. If a racing commit is denied before transaction retry, authorized readback identifies the completed request or conflict; it does not retry a denied write.

## Deployment

**Deploy Hosting and Firestore rules together.** Older rules reject scored adoption; older app tabs cannot make unscored adoptions under these rules. Refresh the app after deployment.

From the extracted project directory on Windows:

```powershell
npm.cmd run deploy:development
```

No dependencies, functions, Firebase configuration, or production deployment changes were made. Nothing was deployed by this task.

## Verification and manual acceptance

Automated coverage includes required/zero scores, cancellation, draft navigation and failed saves, changed-wording review, competing adoption, idempotent retry, atomic initial history, membership boundaries, immutable origin, and formal review inclusion. Run `npm run check` and `npm run test:rules`; final results are in the delivery message.

Browser visual acceptance remains pending. In the deployed app:

1. Open adoption, verify blank scores, then close; the candidate remains pending.
2. Enter one score; adoption stays unavailable. Enter zero as one of two scores and save an optional insight and next step.
3. Check the plotted point, candidate count, preserved candidate origin, and initial history with author/time.
4. Change candidate wording in a second session; verify the first session retains its draft and asks for wording review.
5. Adopt simultaneously from two sessions with different scores; only one wins. Refresh candidates/portfolio in the other session to inspect the saved state.
6. Check desktop and phone drawer layout, keyboard focus, cancellation, project switching, and both formal-review modes.

Next: **2C — Improved guided experience**, with its layout review checkpoint. Candidate merge/split and Miro discovery remain deferred.
