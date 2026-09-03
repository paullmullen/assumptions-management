# Slice 1A — Portfolio workspace structure

September 3, 2026. Implementation delivered against the approved [workspace design](Workspace-Design.md) and [next sprint plan](Next-Sprint-Plan.md).

## Delivered

- Portfolio is the default project view, with a chart and one active-assumption list. The list includes unassessed items and shares numbering/selection with plotted assumptions. It scrolls within the portfolio instead of extending a second long page.
- Three Promises are expandable from the project context, with an incomplete indicator based on loaded saved values.
- Candidates and Reviews have their own project views. Candidate adoption returns to Portfolio and selects the adopted assumption, still unscored as in the accepted baseline.
- Settings & access contains project information and owner-only membership/invitation controls. Active membership remains the security boundary.
- Guided start opens the relevant promises, candidates, portfolio, or review view before focusing it. Existing guidance and browser-local progress remain intact.
- A shared draft guard handles changed scores, insights (including incomplete source/classification drafts), next steps/help, wording, new assumptions, promises, candidates, unpublished reviews, and invitation email entry.
- Selection/view changes, project switching, All projects/Create project navigation, sign-out, and in-app Back/Forward cannot silently discard registered drafts. Save and continue waits for valid successful saves. Keep editing and explicit discard are available. Reviews and invitations are never published/created by the guard.
- Save-in-progress navigation is blocked with a message to retry once saving finishes. Refresh/tab close requests the native browser warning when supported. Drafts remain in memory and are cleared when authorized project content is unmounted.

## Scope and limits

This is **1A**, not completion of Sprint Goal 1. The existing wording controls remain in the one list, scores/insights/management remain below the chart, and history remains below the editor. The single right-side drawer and unified atomic wording/save behavior are next in **1B**. Sorting and recent-change coverage are **1C**; attention priority still needs agreement. Concurrent edit conflict handling and full drawer keyboard/mobile acceptance belong to 1B.

No production dependency, data schema, service, Firestore rule, or deployment configuration changed. No deployment was performed. There is no new review preference or candidate lifecycle work. The Miro discovery item is documented but not investigated.

## Verification

- `npm run check`: passed — formatting, lint, 16 application test files / 66 tests, and production build.
- `npm run test:rules`: passed — 53 Firestore rules tests.
- Test cleanup now allows the existing Ant Design 10 ms validation debounce to settle before jsdom closes. jsdom still reports its unsupported pseudo-element scrollbar measurement during modal tests; no assertions or checks fail.
- Tests cover the sole list, view separation, dirty insight/source handling, failed save/retry, promise collapse/save, candidate capture/adoption, unpublished-review protection, project-unmount cleanup, guide destinations, project switching, Back/Forward, and beforeunload.
- The browser service rejected the local preview URL with ERR_BLOCKED_BY_CLIENT. Browser visual, focus, and responsive acceptance therefore remains open; automated DOM tests are not a substitute for that review.
- The build reports a large-bundle warning. Existing dependencies were retained.

## Development acceptance checklist

1. Open a project. Verify Portfolio comes first, one list includes every assumption, chart/list numbering matches, and Candidates/Reviews/access controls do not extend the portfolio page.
2. Select points using mouse and keyboard. Select an unassessed row. Verify one editable score/insight area and unchanged chart orientation/risk bands. Check both long statements and a portfolio of about 12 items.
3. Enter an insight without changing scores. Switch selection, views, projects, or use Back. Verify Keep editing, failed-save retry, Save and continue, and explicit discard. Repeat with source-only text, scores, next step/help, wording, and new-assumption entry.
4. Expand promises, edit, and attempt to collapse or leave. Repeat for candidate capture/wording, unpublished review cancel, and invitation email entry. Reviews/invitations must require their explicit publication/creation action.
5. Adopt a candidate. Verify it appears once in Portfolio, selected, unscored, and with its origin retained. Verify guide actions open the right view.
6. Open Settings & access as owner and as member. Verify owner-only controls and existing invitation/removal behavior. Remove access from another session and verify project content/draft prompts close.
7. Review wide and narrow layouts, list/plot scroll, keyboard focus, modal focus return, Escape, refresh warnings, and error readability in the development app. Do not claim this visual acceptance from the automated tests alone.

## Next slice

**1B — Assumption drawer**: one draft/save owner for wording, scores, insight, next step/help, and history; atomic saves; close/Escape handling; stale-edit protection; responsive presentation and keyboard focus. Keep candidate merge/split and Miro discovery deferred.
