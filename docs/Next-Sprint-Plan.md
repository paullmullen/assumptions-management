# Assumptions Management — next sprint plan

Date: September 3, 2026  
Status: Adopted plan of record on September 3, 2026. Slices 1A, 1B, 1C, 2A, and 2B are implemented. The user accepted 2A and [2B](Workspace-Slice-2B.md). The user accepted the portfolio workspace through 1C; remaining cross-device/pilot acceptance stays open. See [Slice 2A](Workspace-Slice-2A.md) for the review preference. See [Slice 1C](Workspace-Slice-1C.md) for sorting and the agreed attention rule. See [Slice 1B](Workspace-Slice-1B.md) for verification and required rule deployment. See [Workspace design](Workspace-Design.md) and [Slice 1A](Workspace-Slice-1A.md).

## Objective

Make the existing assessment workflow clear, dependable, and useful to a small pilot team, including a concise project report. Organize the work under Usability, Workflow, Reporting, and Reliability. Deliver one bounded vertical slice at a time, including relevant data, security, tests, and documentation.

These are four ordered sprint goals, not a calendar estimate. Review progress and scope after each delivered slice; do not wait until the whole sequence is complete to get user feedback.

## Baseline and scope decisions

Implemented: verified accounts, isolated projects, promises, active assumptions, scoring/chart, insights and score/management history, formal review snapshots, invitations/membership, optional guidance, candidate capture/edit/adoption.

The user has accepted candidate capture and adoption as sufficient for MVP. Merge/split, discard/entered-in-error, and broader candidate lifecycle extensions are deferred. The new requirement to score immediately during adoption is a refinement of the accepted workflow, not a reopening of the broader lifecycle.

The September 2 source audit still calls candidate consolidation the next slice. This plan supersedes that recommendation. Previously delivered ZIPs are unchanged.

## Priority update — Google sign-in before 2C

The user chose **Continue with Google** to unblock testers without domain registration or SMTP2GO setup. Email/password remains available through Firebase's standard emails. Project contact is **mullenpaull@gmail.com**. Google sign-in and explicit account linking are implemented; provider setup, deployment, and real browser acceptance remain pending. See [Google sign-in](Google-Sign-In.md).

The custom [authentication email implementation](Authentication-Email-Slice.md) is retained but deferred. Do not activate custom email delivery or deploy its Functions for this onboarding slice. No domain or SMTP2GO account is required for Google sign-in.

Once Google onboarding is accepted, resume **2C — Guided experience**.

## Sprint goal 1 — Make the portfolio the primary workspace

Outcome: A user can understand the project, select an assumption, and update it without navigating a long page of duplicate controls.

| Slice                     | Deliverable                                                                                        | Acceptance criteria                                                                                                                                                                                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1A. Workspace structure   | Clear project context, portfolio, and candidate sections; separate Project settings/access surface | One active-assumption list synchronized with the chart. Distinct headings, spacing, and actions. Promises remain easy to view/edit without dominating the workspace. Settings and access are outside the portfolio's vertical flow. Existing membership permissions remain enforced.                               |
| 1B. Assumption drawer     | Right-side drawer for statement, scores, new insights, next step, help needed, and history         | Selecting from either chart or list opens the same assumption. No duplicate editors. Insight-only saves still work. Switching selection, closing, or changing projects cannot silently discard dirty edits. Drawer supports keyboard focus, error recovery, and a usable full-width presentation on small screens. |
| 1C. Useful portfolio list | Sorting by consequence, evidence, recent change, and attention priority                            | Sorting preserves selection. Unassessed items are clearly identified. Recent change includes relevant content updates, not only scoring. Any combined priority rule is explained and retains both scores visibly. Agree on that rule before implementing the sort.                                                 |

Start with a concrete workspace layout for review, then implement 1A and 1B before 1C. Keep all working scoring, history, review, and collaboration behavior intact.

## Sprint goal 2 — Match setup and adoption to how teams work

Outcome: Teams can begin with guidance, score candidates as they adopt them, and choose whether to use formal reviews.

| Slice                         | Deliverable                                                                | Acceptance criteria                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2A. Project review preference | Owner-controlled “Use formal reviews” setting in project creation/settings | Setting is reversible. Existing projects retain reviews enabled. When disabled, normal editing/history/reporting continue and new review actions are hidden/blocked consistently. Prior snapshots remain available in history. Implemented new-project default: reviews off, with an explicit choice during setup.                                               |
| 2B. Score during adoption     | Adoption opens scoring in the shared assumption drawer                     | Both 0–100 scores require deliberate user input; zero remains a valid score. Saving adopts and records initial scores atomically, with author/time and candidate provenance. Cancel leaves the candidate pending. Stale wording and concurrent adoption are handled safely. Existing unscored assumptions are not assigned invented scores.                      |
| 2C. Guided experience         | Floating guide coordinated with the workspace                              | Reuse actual editors; focus/scroll to the appropriate section or open the relevant drawer. Support pause/resume and direct entry. Guide navigation never implies unsaved work was saved. Avoid overlay/focus conflicts with the assumption drawer; use a dedicated guided view at narrow widths if necessary. Keep existing methodology and blind-spot guidance. |

Proposed design: floating guidance on desktop, subject to layout review. A separate questionnaire page remains an alternative if the guide competes with the workspace. Cross-device guidance progress is not required for this increment.

## Sprint goal 3 — Preserve changes and communicate project status

Outcome: The team can explain both its current assessment and how it changed, and share a readable one-page brief.

| Slice                        | Deliverable                                                     | Acceptance criteria                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3A. Complete wording history | Immutable changes for promises and active-assumption statements | Current state and old/new values save atomically with actor/time. No-op edits create no event. Concurrent saves cannot produce false history. History remains available with formal reviews disabled. Earlier missing history is not fabricated.                                                                                      |
| 3B. One-page project brief   | Preview and printable/PDF brief for a sponsor or team review    | Includes project name, report date/basis, concise Three Promises, portfolio chart, a small set of key unresolved assumptions with both scores, and selected next steps/help needed. Works without formal reviews; can use a preserved published review when available. Clearly distinguishes current saved state from a dated review. |

For reporting, settle the page layout and selection rules using a representative project before implementing export. Proposed format: one-page landscape PDF. Let the user select what deserves emphasis rather than silently treating a formula as a decision. Long content must trigger a visible edit/selection step or a clearly labeled excerpt; never silently crop or shrink the report into unreadability. No AI-generated summaries are required. Access to report generation remains project-member-only; no public report links are introduced.

## Sprint goal 4 — Establish pilot readiness

Outcome: A small team can complete the workflow, return later, and trust that its work is retained.

- Run the complete account → project → invitation → promises → candidates/scoring → insight → report → return journey.
- Exercise both review modes, including publishing and comparing snapshots when enabled.
- Verify project isolation, removed-member access, attribution, concurrent edits, failed saves, and data persistence.
- Validate keyboard navigation, focus, labels, contrast, chart interpretation without color, and narrow-screen layouts throughout development, then check the complete experience.
- Have an unfamiliar team attempt guided setup and a facilitated team try a realistic session. Separate methodology confusion from interface problems. Fix blocking findings before broader pilot use.
- Before production use, verify environment/data separation, deployment and rollback procedures, error monitoring/logging, and backup/retention/recovery expectations. Demonstrate recovery at an appropriate level.

Exit: no unresolved blocker involving lost work, unauthorized access, misleading saved/report state, or inability to complete the agreed workflow. Document accepted nonblocking issues. A production deployment is a separate release action, not implied by approving this plan.

## Explicitly deferred or retained for later refinement

| Item                                                                                            | Treatment                                                                               |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Candidate merge/split, discard/entered-in-error, broader lineage                                | Deferred by the user's MVP decision; do not implement as part of this sequence.         |
| Multiple owners and ownership transfer                                                          | Proposed deferment; revisit if a pilot requires owner handoff.                          |
| Automatic invitation emails                                                                     | Proposed deferment; keep copyable, recipient-bound links.                               |
| Activity notifications and digests/preferences                                                  | Proposed deferment until pilot usage identifies worthwhile events.                      |
| Multi-assumption insight relationships and supersession                                         | Previously deferred; preserve single-assumption insights.                               |
| Cross-device guide progress                                                                     | Later enhancement; browser-local resume remains sufficient initially.                   |
| Candidate per-edit history, richer roles, AI, movement traces, integrations, advanced reporting | Outside this sequence. The one-page brief is included; a general report builder is not. |

## Review checkpoints

1. Review workspace layout before committing to the navigation/drawer arrangement.
2. Verify each implementation slice and update its acceptance status; retain the remaining scope visibly.
3. Review floating guidance, new-project review default, attention-priority ordering, and report layout at their relevant slices. These are proposed choices, not settled user requirements.
4. After pilot feedback, prioritize deferred features using demonstrated needs.

## Lower-priority discovery — visual candidate organization

Compare a lightweight Miro-like candidate organization surface with a Miro API/SDK integration after the higher-priority MVP work. Consider facilitated collaboration, grouping, identity/access, data ownership, effort, and cost. No discovery has begun. Candidate capture/adoption is sufficient for MVP; merge/split and broader lifecycle work remain deferred.
