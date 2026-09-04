# Slice 3C — Changes since previous review

The brief shows current saved data by default. Show changes since previous review is initially enabled and can be switched off. Current reports use the latest saved review; historical reports use an earlier saved review with an earlier capture, never current assumptions or insights. The baseline capture date appears in the summary. No baseline shows No previous review. Formal reviews can be off while retained reviews remain usable.

Summary: added assumptions, net changed score pairs (not the number of edits), new insight descriptions, reworded assumptions, changed promises, and assumptions no longer present when applicable. Rows match by immutable assumption ID; insights match by ID and require a nonblank description. Score-only and wording-only entries do not inflate insight counts. Missing historical insight arrays produce Unknown instead of zero. Selected assumptions show prior/current scores and new or wording-change flags. Unassessed values remain explicit. New assumptions have no fabricated prior scores. Excerpt edits do not affect comparison results.

Comparison concerns assumptions in the selected source. Insights on assumptions no longer present are not included. Reverted score or wording edits have no net difference. Changed wording/promises flag that scores may no longer be directly comparable. Changes are not automatically progress. Chart positions and numbers remain those of the selected source, without arrows.

Current source and history are assembled during server reads, not one atomic snapshot. The resulting preview remains stable until refreshed. Required-load failures block reporting rather than showing partial or zero change counts. Existing membership rules apply, including history reads and the access check before printing. No schema, rules, backend, or dependency changes.

User-facing review actions now say Save review and Saved review. Persisted publishedAt/publishedBy fields remain unchanged for compatibility. Reviews do not approve changes. Standalone snapshots and individual accept/reject workflows are deferred.

## Deployment and acceptance

From 3B deploy Hosting only. Nothing was deployed by this slice. Automated comparisons cover ID matching, insight filtering, unassessed/zero scores, historical baseline choice, missing data, failures, checkbox visibility, and membership enforcement. Browser/PDF layout acceptance remains pending: the available browser previously blocked the local preview URL. Page-fit checks still block overflowing reports; no silent clipping or shrinking.

Manual: create a saved review, then change scores several times, add an insight without changing scores, revise wording and a promise, and adopt an assumption. Verify net differences, counts, and dated baseline. Toggle the comparison; source/chart should not change. Open an older review and check it excludes later changes. Verify No previous review on a new project and retained comparisons with reviews off. Print with zero/four selected rows, long excerpts, and comparison on/off; verify a single legible Letter landscape page and blocked export on overflow. Test refresh/source navigation draft protection.

Verification: 132 application tests and 79 Firestore rules/service tests passed; formatting, lint, and production build passed. Browser/PDF visual acceptance remains pending.
