# Slice 3B — One-page project brief

The user approved the landscape MVP design. The report is implemented using current saved state by default, or a chosen published review. A review is a snapshot, not an approval state.

## Use

Open **Project brief** in project navigation. Choose a source, then select zero to four assumptions. Selection order controls report order; Up/Down reorders discussion items without changing chart numbers. Attention-priority sorting is optional and never selects items automatically. The chart retains all assessed assumptions, including unselected ones; unassessed assumptions remain available for discussion.

The Three Promises appear above the chart and discussion items. Each selected item includes consequence, evidence, next step, and help needed. Numbers match the source assumption order. A historical snapshot may number assumptions differently from today's portfolio; the report explains that numbering belongs to its source.

Expand **Shorten text for this report** to edit a report-only copy. Changed fields are marked as excerpts. Restore source removes the excerpt. Source wording and history are not modified. Missing historical fields say Not recorded rather than borrowing current data. Current project name is identified as current when used with an older snapshot.

The preview is fixed to Letter landscape. Its page regions are measured for overflow; the print action is blocked if text does not fit. Select fewer discussion items or shorten the indicated fields. There is no automatic font shrinking or text truncation. On mobile, controls stack and the full-size preview scrolls horizontally.

**Print / Save as PDF** uses the browser print dialog after checking page fit and current project access. Select Letter, landscape, 100% scale, and turn off browser headers/footers. The app does not create a server-stored PDF or public sharing link. The normal browser Print command displays a reminder to use the report action for validation.

## Saved data, drafts, and security

Loads use server reads. Current data is assembled from saved documents during the load, labeled with its load time; it is not a published atomic review snapshot. The loaded preview remains stable until explicitly refreshed. Concurrent remote changes do not silently rewrite it. Failure to load any required source blocks the report instead of producing partial content.

Reports from published reviews use only that review's assumptions, promises, and management fields, with captured and publication dates shown. Published reviews remain available when reviews are turned off. A current report requires no formal review.

Entering the report uses the existing workspace draft guard. Report selections/excerpts are temporary and are protected on refresh, source change, navigation, and sign-out. There is no report Save action; the guard offers Keep editing or Discard changes, not an implication that printing persisted the draft.

Active project membership remains mandatory. Loading and printing recheck authorized project access. Membership loss also removes the workspace through the existing access watcher. Already downloaded/printed copies remain under the user's control. No new production dependency, database schema, rule permission, or custom email service is introduced.

## Deployment and acceptance

Updating from 3A requires **Hosting only**:

```powershell
npm.cmd ci
npm.cmd run build
npx.cmd firebase deploy --only hosting
```

No deployment was performed by this delivery. Automated tests cover source separation, historical missing fields, stable numbering, selection limit, draft protection, excerpts, overflow blocking, print access failure, and report reads/access checks with reviews off, nonmembers, and removed membership.

Browser verification was blocked by the Cloud browser's local-URL policy. Actual layout, browser print dialog, and generated PDF pagination still need manual acceptance. The local fixture at `/tests/browser/report-preview.html` under `npm run dev` shows the actual report component with illustrative data and an oversized-promise toggle; it is not included in the production build.

Manual checklist: current project and old review; zero/four selections; empty/all-unassessed portfolio; long words/paragraphs; coincident chart points; source switching with unsaved excerpts; narrow-screen preview; print to PDF with backgrounds enabled; verify exactly one page and readable labels. Check that a blocked print displays the relevant fit warning, not a cropped report.

## Backlog and proposed follow-up

Coach/facilitator global read access with future delegated roles is recorded in Next-Sprint-Plan.md. It remains a separate permission-design task.

The user asked about showing progress since the last review. Proposed follow-up: a compact change summary and previous/current scores for selected assumptions, keeping the chart at current positions. Revised wording and added assumptions need explicit labels. No comparison or approval badge is invented by this release. Settle that presentation before extending the report.
