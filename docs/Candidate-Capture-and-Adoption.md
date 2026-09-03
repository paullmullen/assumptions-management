# Candidate capture and adoption

Open **Candidate workshop → Open candidates** above the active assumption editor. Paste one candidate per line; blank lines are ignored. Save up to 20 lines per submission, each up to 2,000 characters. There is no limit of 20 on the total candidate collection. Questions and common task-like wording receive a nonblocking hint.

Pending candidates are separate from the active portfolio. Edit wording, then choose **Adopt into portfolio** to open the shared assumption drawer. Enter both initial scores (whole numbers 0–100; zero is valid), then choose **Adopt with scores**. Nothing is created until that save succeeds. Cancel leaves the candidate pending. The saved assumption opens in the portfolio. See [Slice 2B](Workspace-Slice-2B.md). Direct active-assumption entry remains available. A soft reminder appears above 12 active assumptions.

**Show adopted** reveals the preserved candidate wording and original author. Adopted candidates cannot be rewritten or deleted; further wording changes belong to the active assumption. The active record carries its candidate origin. Candidate creator/email/time and adopter/time remain stored. Pending edits retain current wording and latest editor/time, not a full per-edit history.

Hide/reopen preserves unsaved workshop text while the project remains open. Changing projects or reloading requires saving first. Use **Refresh candidates** to see another member’s changes. If wording changes while scoring, the drawer retains scores and notes and offers the latest wording for review before another save. Successful writes update the local display without relying on a second read.

## Data and security

- `projects/{projectId}/candidates/{candidateId}` holds pending/adopted candidates under active project membership.
- Adoption atomically marks the candidate adopted, creates `assumptions/{candidateId}` with both scores and immutable `sourceCandidateId`, and writes initial score/insight/management history. The candidate retains `adoptionInsightId`. Rules enforce matching project, statement, actor, server time, and all three writes.
- Retries from the same unchanged drawer request confirm its existing adoption without duplicate history. A competing request fails visibly and retains the losing draft; it never overwrites the winner or silently accepts different scores. Authorized readback can identify a completed request after a racing permission rejection, without retrying a denied write.
- Adopted candidate records and the active origin link are immutable. Candidates cannot be hard-deleted. Pending records cannot carry scores.
- Existing active assumptions need no migration. Pending candidates never enter the current formal-review capture. Adopted assumptions enter subsequent captures normally; prior published reviews remain unchanged.
- No new production dependency or Cloud Function is required. Updated Firestore rules must be deployed with the app.

Merge, split, discard/entered-in-error states, detailed candidate edit history, and lineage comparison remain outside this bounded slice.

## Manual acceptance

1. Deploy with `npm.cmd run deploy:development`, then open an existing project. Confirm existing assumptions and scores are intact.
2. Open Candidate workshop; save multiple lines. Confirm they appear as pending and are absent from the portfolio/chart and a fresh review capture.
3. Edit a candidate. Adopt it. Enter both scores and an optional insight; confirm one scored active assumption appears and initial history is recorded. Cancel once before saving to verify the candidate remains pending.
4. Show adopted candidates. Confirm the original candidate remains attributed and cannot be edited, while active wording can still change.
5. Using a second member account, edit a pending candidate. Try adopting the stale wording in the first account: it should show the latest wording while retaining scores. Review that wording and adopt.
6. Have both members adopt the same pending candidate; confirm one active assumption. Refresh a review capture and confirm adoption appears as a new assumption.
7. Remove the member and verify candidates are no longer accessible. An unrelated account must not discover or read them.
8. At mobile width and by keyboard, check entry, edit, adoption, and Show adopted. Confirm hiding/reopening retains unsaved text, and failed saves leave text available.

Automated checks exercise bulk validation, optional wording hints, draft preservation, edit/adopt UI, failure recovery, membership boundaries, atomicity, immutable provenance, stale/concurrent adoption, the 20-item batch, and review exclusion/inclusion.
