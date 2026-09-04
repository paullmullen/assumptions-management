# Slice 3A — Immutable assumption wording and promise history

## Result

Each change to an existing assumption's statement now adds a `wordingChange` (previous/new text) to its existing immutable insight history. Wording, scores, management fields, and an optional insight saved together appear in one attributed event. Author UID, email, and server time accompany the record. New assumption creation keeps its existing creation metadata; there is no fabricated previous wording.

The Three Promises editor now saves through a Firestore transaction with an immutable event under `projects/{projectId}/projectBrief/overview/history`. Events preserve all three previous/new values; the display shows only the promises that changed. First entry records the prior unset values; clearing a promise is recorded too. Both history displays use newest-first order and remain available when formal reviews are disabled.

Existing documents do not need migration. Missing earlier history is not reconstructed. The first post-upgrade change uses the actual saved wording as its previous value. Trimmed input identical to the saved values creates no history event or timestamp update.

## Concurrency and permissions

Assumption saves retain the existing baseline conflict handling. Promise saves now compare the editor's loaded values with the transaction's current values. A conflict retains the draft and presents the latest saved promises. The user must explicitly choose to keep the reviewed draft or use the latest saved promises. Failed saves stop guarded navigation; failure to load promises disables editing until a successful retry.

Firestore rules require each wording update to reference a newly created, matching history record in the same atomic operation. They validate previous/new values, actor, email, and server timestamp. History cannot be edited or deleted by browser clients. Active project membership remains the read/write boundary, including history access after member removal. These are client security guarantees; privileged Admin SDK operations remain governed by administrative access.

No production dependency, formal-review behavior, candidate lifecycle, or authentication flow was changed. Candidate wording before adoption remains outside this history slice.

## Deployment

Deploy **Hosting and Firestore rules together** from this ZIP:

```powershell
npm.cmd ci
npm.cmd run deploy:development
```

This builds the app and deploys Hosting plus Firestore rules; it does not deploy the deferred email Functions. Reload already-open browser tabs after deployment. Old clients that try to change wording without matching history will be rejected. Do not roll back to rules that permit unrecorded wording edits; an older frontend may need to remain read-only for wording until the updated frontend is restored.

Nothing was deployed by this delivery. No data backfill is required.

## Verification and acceptance

Rules/service coverage includes combined assumption edits, consecutive wording changes, trimmed no-ops, exact promise from/to values, clearing promises, competing promise transactions, forged/orphan records, attribution, immutability, project isolation, removed-member access, and operation with formal reviews off. UI coverage includes history rendering/retry, stale promise draft retention and explicit review, blocked editing after load failure, and existing unsaved-navigation regressions.

Manual browser acceptance remains pending: edit an assumption twice and inspect both previous/new pairs; change and clear promises; attempt overlapping edits in two sessions; check history with formal reviews off; check keyboard/mobile history readability. Historical text is displayed in full with preserved line breaks.

Next after acceptance: **3B — One-page project brief**. Review its representative layout and content selection before implementing export, as required by the plan.
