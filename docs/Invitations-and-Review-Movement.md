# Guided invitations and movement since review

Two requested follow-ups to the accepted candidate-board baseline. No production dependencies, data migrations, Firestore rules, or backend changes.

## Invite the team during guided startup

After defining the promises, the guide offers Invite your team. The owner can open the existing Settings & access invitation controls, enter the recipient's email, create an invitation, and manually share the copied link. Skip for now advances to candidate work. Reopen guided start to resume; invitations remain available later in Settings & access.

Ordinary members see an explanation that only the owner can invite, plus a link to project access information. This does not broaden invitation permissions or send messages automatically. Existing navigation protection applies to transitions. Saved browser progress from the five-step guide is migrated to the corresponding step in the six-step guide; it is not reset or mistaken for invitation completion.

## Show movement since last review

In Portfolio, turn on Show movement since last review. It loads the most recently saved formal review using the existing member-authorized server read. The review title and capture date identify the baseline. Refresh review baseline reloads it; toggling off returns to the normal chart. The checkbox is off initially to avoid crowding the chart.

An outlined circle marks the prior score position; an arrow points toward the current point. Positions and numbers of current assumptions remain unchanged, and clicking a current point still opens the same editable drawer. Only pairs with valid scores on both sides and a net score change get arrows. New assumptions, unassessed transitions, and unchanged pairs have explicit text in Movement details. Assumptions match by ID, not wording. Changed wording is flagged so the team can judge whether the comparison is meaningful.

This shows net movement between the saved review and the portfolio currently displayed, not a trace of every edit, acceptance/rejection, or proof of progress. Review data remains stable until refreshed; portfolio data follows the existing load/save behavior. Reload the project to include teammates' latest changes. If a baseline was captured after the portfolio was loaded, movement is withheld with a Refresh portfolio action; turn movement on again after that refresh. Small moves or overlapping points may overlap visually; Movement details provides exact previous/current scores. Collision offsets on current dots remain display-only; arrows originate from the actual scores.

A missing review displays No previous review. A failed review read displays a retryable warning and leaves current positions available without arrows. Previously saved reviews remain usable when formal reviews are turned off. Removed/absent assumptions are not plotted as current assumptions. The one-page brief retains its existing comparison summary; arrows are limited to the interactive portfolio in this slice.

## Deployment and checks

Updating from the accepted candidate board requires Hosting only:

```powershell
npm.cmd ci
npm.cmd run build
npx.cmd firebase deploy --only hosting --project assumptions-management
```

Refresh open tabs after deploying. Nothing was deployed during development.

Manual acceptance: follow guided startup as owner and member; skip invitations and revisit; open/share an invitation and accept it in another account. Verify old guide progress resumes correctly. Save a review, change one or both scores, and enable movement; confirm arrows, dates, details, and point selection. Include zero, new/unassessed assumptions, unchanged scores, changed wording, missing reviews, reviews off, a newer baseline, and a failed baseline load. Check mobile and keyboard use and busy/dirty editor navigation. Real browser/visual acceptance remains pending; automated DOM tests are not screenshots or OAuth acceptance.

Verification: 143 application tests passed, including guide migration, owner/member invitation guidance, navigation to access controls, missing/failed/newer review baselines, arrow selection, zero/unassessed scores, and unchanged pairs. Formatting, lint, and production build passed. The existing 84 rules/service checks from the accepted candidate-board release remain applicable; no rules or backend changes were made in this slice. Browser/visual acceptance remains pending.
