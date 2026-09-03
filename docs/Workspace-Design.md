# Assumptions Management — portfolio workspace proposal

September 3, 2026 · Approved plan of record

## Recommendation

Make Portfolio the default project view. Give the chart and one synchronized assumption list the main screen. Open an immediately editable right-side drawer when an assumption is selected. Use project navigation for Candidates and Reviews, and a separate Settings & access surface. Keep the Three Promises one click away above the portfolio.

This proposal follows Sprint Goal 1 of the attached plan and the repository's AGENTS.md: bounded slices, low friction, active-membership security, no deferred feature expansion, and relevant verification after implementation. No new production dependency is proposed.

## Proposed layout

| Screen area, top to bottom | Contents and behavior                                                                                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application header         | Product name, project switcher, All projects/Create project, account/sign out. Avoid repeating the active project name here and in the page title.                                                                                                      |
| Project context            | Project name as the main heading; compact description; **Three Promises** and **Settings & access** actions. Promises expand directly below this row for reading/editing; normally collapsed, with an obvious incomplete-state prompt when appropriate. |
| Project navigation         | **Portfolio** (default), **Candidates** (pending count), **Reviews**. **Guided start** remains a secondary action with the existing guidance content and browser-local progress.                                                                        |
| Portfolio heading          | “Assumption portfolio,” active/unassessed counts, **Add assumption**. Retain the soft guidance when the portfolio exceeds about 12 assumptions.                                                                                                         |
| Main portfolio surface     | Chart on the left, approximately 60% of available width; one assumption list on the right, approximately 40%. The chart's risk-band legend stays with the chart.                                                                                        |
| Editor, when selected      | Right-side assumption drawer, about 480–560 px wide. The chart and list remain available for selecting another assumption on a sufficiently wide screen.                                                                                                |

Use a wider desktop content container than today's 1120 px limit. Give context, navigation, and portfolio distinct spacing and headings; use restrained borders/backgrounds rather than putting every field in another card. There is no candidate form, access panel, review panel, or second active-assumption list below the portfolio.

Candidates and Reviews are peer views within the same project. The candidate view retains the accepted capture/edit/adoption workflow. Adoption returns to Portfolio and selects the adopted assumption; requiring initial scores remains Goal 2B. Reviews retain their existing snapshot, publication, and comparison behavior, clearly labeled as dated saved state.

Settings & access is a separate project view reached from the context row. Initially it houses existing project information and owner-only invitation/membership controls. Do not invent new editable settings or expose owner controls to other members. Formal-review preferences arrive in Goal 2A.

## The single assumption list

- Each row shows its chart reference, statement, Criticality, Evidence, and selected state. Use text labels as well as score colors.
- Include every active assumption, including **Not assessed** items. An unassessed item opens the same drawer but is not plotted; retain any existing individual score without inventing the missing score.
- Clicking a row or chart point selects the same assumption and opens the same editor. Clicking the already selected item never resets its draft.
- Retain chart-reference numbering independently of list sort order; selection always uses the assumption ID. These references are display aids, not new permanent identifiers.
- The chart shows saved scores. Draft edits remain in the drawer until Save succeeds; moving dots before persistence would imply a saved change.
- Closing the drawer retains selection/highlighting. Opening it again is one click. Sorting in 1C must preserve selection and open drafts.
- Remove both the separate “Saved assumptions” editor list and the chart's duplicate statement key, replacing them with this one list. Keep the color/risk legend.

## Assumption drawer

Use one scrollable form, not multiple editor tabs. Keep a sticky heading/close control and sticky save footer. Fields are editable immediately.

| Order       | Content                                                                                                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header      | Assumption reference, “Unsaved changes” when applicable, close button.                                                                                                                                                 |
| Wording     | Full affirmative statement, editable without an Edit button; preserve existing length limits and guidance.                                                                                                             |
| Assessment  | Criticality if wrong and Strength of supporting evidence, side by side when space permits. Keep existing score guidance in an expandable section and the nonblocking criticality-change reminder.                      |
| New insight | Description; optional source URL and classification. This is the only insight entry location.                                                                                                                          |
| Action      | Next step and Help needed, both optional.                                                                                                                                                                              |
| History     | Expandable existing insights and changes, including actor/date and from–to score/management values. Loading errors have Retry and do not erase drafts. Do not label this as complete wording history; that is Goal 3A. |
| Footer      | **Save changes**, **Revert changes**, and save/error status. Saving leaves the drawer open for continued work.                                                                                                         |

Insight-only saves remain valid even when scores are unchanged or unassessed. A source/classification draft counts as unsaved work even before an insight description is valid. Zero remains a valid score. A changed score pair must satisfy the existing integer/range rules.

Add assumption opens the same drawer in creation mode with the existing required statement. Initial scores remain optional in this goal. Candidate provenance and all existing creation permissions remain intact.

## Unsaved work and navigation

Register editable drafts with a shared navigation guard; drawer-local protection is insufficient because project navigation lives above the editor.

| Event                                                                                                            | Proposed behavior                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Close, Escape, select another assumption, leave the project/view, switch projects, or sign out with dirty fields | Ask **Save and continue / Discard changes / Keep editing**. Keep editing is the safe default. Name the affected editor.                                                                           |
| Invalid draft or failed save                                                                                     | Stay on the same assumption/project, retain all values, show the field/error, and do not perform the pending navigation.                                                                          |
| Save in progress                                                                                                 | Disable duplicate saves and defer navigation until the result is known.                                                                                                                           |
| Back/forward navigation                                                                                          | Use the same guard; do not merely guard the project-switcher button.                                                                                                                              |
| Browser refresh/tab close                                                                                        | Request the browser's native unsaved-work warning when supported. This is not a guarantee against browser crashes or process termination.                                                         |
| Remote update while editing                                                                                      | Do not replace typed values. Check the saved baseline in the save transaction; if a field being edited changed remotely, keep the draft and offer review/retry rather than silently overwrite it. |
| Membership revoked                                                                                               | Stop showing project data and block writes. Draft protection must not prolong unauthorized access or copy private drafts to persistent browser storage.                                           |

Apply draft protection to promises, direct assumption creation, candidate edits/capture, and unpublished review drafts when moving these surfaces. Publishing a review is always explicit: a navigation prompt must never silently publish it. For an unpublished review, offer Keep editing or Discard review draft as appropriate. Only one editing surface should be active at a time; route attempts to open another through the guard.

Revert changes is an explicit discard action. It restores saved values and clears the unsaved insight; require confirmation when it would erase typed work.

## Responsive and keyboard behavior

On wide screens, reserve space for the drawer and reflow the remaining portfolio rather than shrinking the chart into unreadability. When chart, list, and drawer no longer fit, let the drawer overlay the workspace; provide a full-width drawer on small screens. With the drawer closed, stack chart above list on narrow screens and keep both scores accessible without relying on the plot.

On a nonmodal desktop drawer, keyboard users can move between list and editor. On an overlay/modal drawer, constrain focus appropriately. Focus its heading on open without forcing a mobile keyboard; return focus to the triggering row/point on close. Escape uses the dirty-work guard. Prevent background interaction on modal layouts and avoid stacked editing drawers. Guide actions must open the relevant view or promises section before moving focus.

## Findings from the supplied source

| Source                    | Finding and consequence                                                                                                                                                                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.jsx`             | ProjectScreen stacks guidance, full promises, assumptions, reviews, and owner membership controls vertically. Route changes and sign-out bypass any shared draft guard; ProjectScreen is keyed by project/user and unmounts on a project switch.                                                          |
| `AssumptionsPanel.jsx`    | Owns candidates, direct creation, a Saved assumptions list, wording editing, chart selection, and history. These responsibilities need separation around one selected ID and draft owner.                                                                                                                 |
| `PortfolioChart.jsx`      | Contains an assessed-only statement list and SelectedScoreEditor. Extract editing/list ownership while preserving chart geometry, orientation, collision handling, labels, and risk bands.                                                                                                                |
| `SelectedScoreEditor.jsx` | Already retains score, insight, and management drafts per assumption while mounted, handles insight-only saving, and retains failed saves. This is useful behavior to preserve, but it does not protect project unmounts or separate wording edits.                                                       |
| `services.js`             | Scores, insights, and management changes use a transaction; wording uses a separate update. One Save changes button requires a unified atomic save, not two sequential calls that can partially succeed. Extend only the necessary save/rule behavior; immutable wording/promise history remains Goal 3A. |
| `services.js`             | Insight-only saves do not currently advance the assumption's updatedAt. Slice 1C must account for insight activity before claiming “recent change” ordering.                                                                                                                                              |
| `GuidedStart.jsx`         | Actions currently focus/scroll to DOM IDs. Navigation changes need a small adapter so the existing guide still works. The redesigned floating guide remains Goal 2C.                                                                                                                                      |

The initial design inspection was static. Implementation and verification are tracked separately in Workspace-Slice-1A.md.

## Bounded delivery sequence

1. **1A — Workspace structure:** project navigation/context, compact promises, separate settings/access, and one synchronized list. Preserve current editor behavior during the move. Introduce navigation protection wherever moving a form would otherwise lose its draft. Verify candidate adoption, guide destinations, reviews, permissions, and empty/unassessed states.
2. **1B — Assumption drawer:** move all assumption fields/history into the drawer; unify draft/save ownership and atomic saves; complete close/selection/navigation protection and responsive/focus handling. Test combined and insight-only saves, failed saves, stale edits, project switches, Escape/back navigation, and removed-member access. Run the relevant rule checks for any service/rule changes, plus formatting, lint, unit tests, and build.
3. **1C — Useful list sorting:** add consequence, evidence, and recent-change sorting. Agree on an attention-priority rule before implementing it; no formula is chosen here. Resolve recent-change data coverage as part of this slice.

Review each delivered slice before expanding scope. The user approved this proposal as the plan of record. Slices 1A and 1B are implemented; see Workspace-Slice-1A.md and Workspace-Slice-1B.md for verification and remaining acceptance checks.

## Backlog addition and retained scope

**Lower-priority discovery: visual candidate organization.** Compare a lightweight Miro-like grouping surface with a Miro API/SDK integration. Later discovery should consider facilitated collaboration, grouping, identity/access, data ownership, integration effort, and cost. No research or implementation in Sprint Goal 1. Candidate capture/adoption is accepted for MVP; merge/split and broader lifecycle work remain deferred.

The attached plan's later goals remain: optional formal reviews, scoring during adoption, guided setup improvements, immutable wording/promise history, a one-page project brief, and pilot readiness.

Slice 1C is implemented: the user approved attention priority as criticality minus evidence, highest first, with unassessed work first. See [Slice 1C](Workspace-Slice-1C.md) for sorting behavior and recent-activity coverage.
