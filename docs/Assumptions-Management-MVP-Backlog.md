# Plan of record — September 3, 2026

The approved [Next sprint plan](Next-Sprint-Plan.md) and [workspace design](Workspace-Design.md) govern the next implementation sequence. Slice 1A makes Portfolio the main view, with a single chart/list selection, separate Candidates/Reviews and Settings & access, compact promises, and shared draft protection. See [Slice 1A delivery](Workspace-Slice-1A.md).

**1B — Assumption drawer** is now implemented, including atomic saves and conflict review; see [Slice 1B](Workspace-Slice-1B.md). Next: **1C — Portfolio sorting**, after agreeing on attention priority. Candidate capture/adoption is accepted as sufficient for MVP. Earlier consolidation recommendations below are superseded; merge/split and broader lifecycle work are deferred. A lower-priority discovery item compares Miro-like candidate organization with Miro API/SDK integration; do not investigate it first.

The following entries preserve implementation history and the original backlog; they do not override the approved sequence or scope.

# Current implementation refinement — Candidate capture and adoption

Members can now capture candidate assumptions individually or through multiline paste, edit pending wording, and explicitly adopt into the active portfolio. Adoption is atomic, unscored, retry-safe, and preserves the original candidate and author plus adoption metadata. Candidates stay out of review captures until adopted. Soft wording and portfolio-size guidance are included. See [Candidate capture and adoption](Candidate-Capture-and-Adoption.md). Merge/split, discard/entered-in-error, and detailed candidate edit history remain outstanding; this does not complete the entire candidate lifecycle.

# Current implementation refinement — Optional guided start

An optional, reopenable guided start now explains promises, affirmative assumptions, blind spots, assessment, and learning/reviews. It navigates to the existing editors without duplicate forms or required steps. Progress is remembered per account/project on the same browser; it is not synchronized across devices. See [Guided start](Guided-Start.md) and the [MVP status audit](MVP-Status.md). This completes a bounded guidance slice, not the candidate workshop or the full MVP.

# Current implementation refinement — Invitations and shared access

Owners can now create email-addressed invitation links, inspect accepted members, revoke invitations, and remove member access. Only the intended verified account can accept a pending unexpired invitation. Server-enforced Firestore rules protect atomic acceptance/removal and immutable event history. See [Project collaboration](Project-Collaboration.md). This bounded slice uses existing Firebase dependencies and does not send invitation emails automatically. Multiple owners/ownership transfer, candidate lifecycle, notifications, and final pilot acceptance remain outstanding.

# Current implementation refinement — Formal reviews

Basic formal reviews now capture the saved portfolio and Three Promises, compare against the previous published review, accept notes, and publish a member-attributed immutable snapshot. New insights, scores, wording, next step, and help needed are inspectable. See [Formal reviews](Formal-Reviews.md) for acceptance checks and the snapshot consistency/security boundaries. Merge/split lineage awaits the candidate lifecycle. Automatic invitation emails, ownership transfer, candidate lifecycle, notifications, and final pilot acceptance remain outstanding; this delivery does not mark the whole MVP complete.

# Current implementation refinement — Management record

Next step and Help needed are now optional current fields in the single assumption editor. Changes save independently or with scores/insights and retain immutable previous/new values, author, and timestamp. Responsible person and target date remain deferred. See [Next step and help needed](Next-Step-and-Help-Needed.md). Basic formal reviews are now implemented; other unimplemented backlog items remain outstanding.

# Current implementation refinement — New Insights

The delivered New Insights slice supersedes the evidence-only scope below: each append-only insight belongs to one assumption, with description, author, server date, optional source URL, and optional classification. It can represent evidence, revised judgment, or a mitigation/project change. Multi-assumption links and rejection/supersession are deferred. Insights never automatically change scores or gate scoring. One consolidated editor and Save changes action accepts an insight alone, a score change alone, or both atomically. The former separate insight form and list score form have been removed; list actions focus the same editor. Actual score changes now append immutable from/to values with optional insight, author, and timestamp in one transaction. Rules enforce matching history for score updates. Older score values are not backfilled. See [New Insights](New-Insights.md) for implemented behavior and acceptance checks. Remaining historical backlog items are not claims of implementation.

# Assumptions Management Webapp

## MVP Product Baseline and Implementation Backlog

**Status:** Initial baseline for review  
**Date:** 2026-08-28

## 1. Product purpose

Help teams identify the assumptions underlying their promises, focus learning on the assumptions with the greatest unresolved consequences, and make progress with clarity about what remains uncertain.

The product begins as a guided or facilitated assessment and becomes a shared team-management tool. It is not merely a web version of the existing Excel workbook.

## 2. Core methodology

Teams begin by describing three promises:

1. **Customer Promise — Value Proposition:** What are we promising the customer?
2. **Investor Promise — Business Case:** What are we promising the person or entity making the project financially possible? “Investor” may include donors, grantmakers, sponsors, internal funders, or conventional investors.
3. **Coworker Promise — Company Culture:** What are we promising the people working together to deliver it?

The team then asks:

> What is true—or must become true—for us to deliver these three promises?

Candidate assumptions are generated, edited, consolidated, split when necessary, and reduced to a manageable active portfolio. About 12 active assumptions is useful guidance, not a hard limit.

Each active assumption is assessed on two dimensions:

- **Horizontal:** Consequence if the assumption is wrong.
- **Vertical:** Strength of evidence supporting the validity of the assumption, ranging from a reasonable guess to evidence-based proof.

The highest-priority assumptions generally appear in the upper-right region: severe consequences if wrong and weak support for validity.

Most movement over time is vertical as evidence changes. Contrary evidence may move an assumption upward. Horizontal movement is less common but may occur when mitigation or project changes alter the consequence.

## 3. MVP principles

1. **Project isolation is non-negotiable.** Only active project members may discover or access project data.
2. **The method stays lightweight.** Direct editing is the MVP default; governance overhead is not imposed prematurely.
3. **History is automatic.** Meaningful changes are preserved without requiring users to perform administrative work.
4. **Guidance is helpful, not coercive.** The app coaches affirmative wording and manageable portfolio size without blocking reasonable exceptions.
5. **The chart does not imply false precision.** A 0–100 scale supports placement, but exact numeric differences are not treated as scientific measurements.
6. **The app is not a general task manager.** It records agreed next steps and help needed.
7. **Continuous work and episodic review coexist.** Current project state evolves continuously; formal reviews preserve discrete snapshots.
8. **The MVP preserves future analytical options.** Immutable change events and review snapshots enable later traces, animation, and analytics.
9. **Self-guided adoption matters.** Teams unfamiliar with the method should be able to begin without a facilitator.
10. **Bias strongly toward simplicity and low user friction.** When two or more viable options are available, prefer the option that requires the least effort, explanation, and ceremony from the user. Do not over-constrain normal work. Use sensible defaults, optional guidance, and soft warnings before required fields, approval steps, rigid workflows, or hard limits unless a constraint is necessary for security, data integrity, or a clearly established user need.

## 4. MVP user and access model

- Anyone may create an account and create a project.
- The project creator becomes its initial owner/administrator.
- A project may have more than one owner/administrator.
- Ownership may be transferred.
- Owners invite people to a project using their email addresses.
- A user may belong to multiple projects.
- A signed-in user sees only projects for which they have an active membership.
- Projects share one application, authentication system, backend, and database.
- The project is the tenant and security boundary.
- Fine-grained editor, reader, facilitator, approver, or reviewer roles are deferred.
- For the MVP, project owners manage the project and membership; other active members participate fully in project content.

## 5. MVP completion definition

The MVP is complete when a new user can:

1. Create and verify an account.
2. Create a private project.
3. Invite collaborators and manage membership.
4. Select among authorized projects without exposure to other projects.
5. Define the Customer, Investor, and Coworker promises.
6. Use an optional guided assessment or proceed directly.
7. Generate, edit, merge, split, discard, and adopt candidate assumptions.
8. Assess active assumptions on both axes.
9. View a synchronized graphical portfolio and prioritized list.
10. Record next steps and help needed.
11. Add append-oriented evidence and relate it to one or more assumptions.
12. Change scores directly and see immutable change history.
13. Conduct and publish a basic formal review snapshot.
14. Sign out, return later, and continue managing the same project.
15. Use deployed production software with appropriate automated security and workflow tests.

---

# 6. Prioritized epics and stories

## Epic E0 — Product and engineering baseline

**Outcome:** Implementation begins from an agreed vocabulary, scope, data ownership model, and working process.

### E0-S1 — Establish the repository and application baseline

As the product team, we need a consistent repository and development workflow so implementation remains understandable and reproducible.

**Acceptance criteria**

- React, Vite, and Ant Design application starts locally.
- Firebase development configuration is separated from production configuration.
- Local emulator workflow is documented.
- Automated formatting, linting, unit-test, and build commands exist.
- CI runs the agreed checks on proposed changes.
- A concise README explains local startup, testing, and deployment boundaries.

### E0-S2 — Record product terminology and decisions

As the product team, we need one authoritative source for settled requirements and open decisions.

**Acceptance criteria**

- Core terms are defined: promise, candidate assumption, active assumption, evidence, assessment, review, project member, and project owner.
- MVP and deferred scope are recorded.
- Open decisions have owners or a planned backlog point for resolution.
- Product decisions are updated as slices are accepted.

## Epic E1 — Walking skeleton: authenticated, isolated projects

**Outcome:** The smallest end-to-end application proves authentication, persistence, project membership, security isolation, and deployment.

### E1-S1 — Create and verify an account

As a new user, I can create and verify an account so my identity can be used for protected project access.

**Acceptance criteria**

- A user can sign up, verify their email address, sign in, sign out, and recover access.
- Protected application routes require authentication.
- A minimal user profile is created without storing unnecessary personal information.
- Authentication failures do not reveal sensitive account information.

### E1-S2 — Create a private project

As an authenticated user, I can create a project so I can begin an assumptions assessment.

**Acceptance criteria**

- Project name is required; description is optional.
- The creator becomes an active project owner.
- The new project appears in the creator’s project selector.
- Another authenticated user cannot discover or read the project without membership.
- Project creation and ownership assignment are atomic.

### E1-S3 — Select an authorized project

As a user with one or more memberships, I can enter the project in which I intend to work.

**Acceptance criteria**

- A user with multiple projects sees a project-selection page.
- A user with one project can enter it with minimal friction.
- The active project is unmistakable in the application header.
- A project switcher lists only authorized active projects.
- Authorized deep links open the intended project.
- Unauthorized deep links reveal no project metadata.

### E1-S4 — Invite and add a project member

As a project owner, I can invite another person so we can collaborate in the same project.

**Acceptance criteria**

- Invitations are addressed to a specific email address.
- Only the intended verified account can accept an invitation.
- Invitations expire and can be revoked.
- Acceptance creates an active project membership.
- A newly active member can access only the invited project and any other projects where separately authorized.
- Invitation and acceptance events are recorded.

### E1-S5 — Manage project membership and ownership

As a project owner, I can manage access without destroying historical attribution.

**Acceptance criteria**

- Owners can view active members and pending invitations.
- Owners can remove a member, immediately ending future access.
- Historical records continue to identify removed members’ earlier actions.
- Projects always retain at least one owner.
- Ownership can be added or transferred safely.

### E1-S6 — Prove project isolation

As the product owner, I need automated proof that one project cannot access another project’s data.

**Acceptance criteria**

- Firestore rules deny unauthenticated project access.
- Rules deny authenticated nonmembers.
- Rules allow authorized project operations appropriate to MVP owner/member distinctions.
- Tests cover guessed identifiers, direct document access, queries, removed memberships, and cross-project writes.
- Backend functions independently verify project authorization.

### E1-S7 — Persist one basic assumption end to end

As a project member, I can create and revisit one basic assumption so the complete application path is proven.

**Acceptance criteria**

- A member can create an affirmative text statement in the active project.
- The assumption persists across sessions.
- Another project cannot read it.
- The creator and creation time are recorded.
- This story intentionally excludes scoring, charting, evidence, and workflow sophistication.

## Epic E2 — Project promises and optional guided start

**Outcome:** A new or experienced team can establish project context and choose guided or direct entry.

### E2-S1 — Define the three promises

As a project member, I can define the Customer, Investor, and Coworker promises so the assumptions have shared context.

**Acceptance criteria**

- All three canonical promise labels are used.
- Guidance explains the meaning of each promise.
- Investor guidance includes donors, sponsors, internal funders, grantmakers, and conventional investors.
- Promise statements remain visible and editable in project context.
- Assumptions are not required to map formally to promises.
- Promise changes are included in project history.

### E2-S2 — Choose guided or direct setup

As a project creator, I can use a guided assessment or proceed directly so the app accommodates both unfamiliar and experienced teams.

**Acceptance criteria**

- The choice is clear but reversible.
- Guided setup can be paused and resumed.
- Direct entry does not create missing-data errors or block later use of guidance.
- The wizard does not prevent experienced teams from reaching the portfolio quickly.

### E2-S3 — Provide methodology guidance

As an unfamiliar team member, I can understand the method while using it.

**Acceptance criteria**

- Guidance explains promises, assumptions, both axes, and prioritization.
- Examples distinguish assumptions from tasks, risks, questions, and desired outcomes.
- Guidance is concise and available again after initial setup.
- Empty states teach the next useful action.

## Epic E3 — Candidate assumption development

**Outcome:** Teams can move from idea generation to a concise set of well-stated active assumptions.

### E3-S1 — Capture candidates rapidly

As a participant, I can enter candidate assumptions quickly so idea generation is not slowed by administration.

**Acceptance criteria**

- Candidates can be entered individually and through multiline bulk paste.
- Scoring is not required during candidate generation.
- Candidates record creator and creation time.
- Draft candidates remain within the project security boundary.

### E3-S2 — Coach affirmative wording

As a participant, I receive help stating assumptions affirmatively without being blocked by an imperfect rule.

**Acceptance criteria**

- The UI explains affirmative assumption wording.
- Obvious questions or action statements may receive a soft warning.
- Users may continue despite the warning.
- Any suggested rewording is accepted only through an explicit user action.

### E3-S3 — Edit and consolidate candidates

As a team, we can refine and consolidate candidates into a manageable portfolio.

**Acceptance criteria**

- Candidates can be edited.
- Two or more candidates can be merged into a new candidate or active assumption.
- A candidate can be split into two or more successors.
- Merge and split operations preserve lineage.
- A candidate can be discarded without permanent historical erasure.
- The application warns, but does not block, when the active set exceeds about 12 assumptions.

### E3-S4 — Promote candidates to the active portfolio

As a team, we can adopt refined candidates as active assumptions.

**Acceptance criteria**

- Adoption is explicit.
- Adopted assumptions retain candidate provenance.
- Active assumptions appear in the portfolio list.
- Candidate and active views clearly distinguish their purposes.
- Administrative mistakes can be marked as entered in error without ordinary hard deletion.

### E3-S5 — Offer a non-AI blind-spot check

As an unfamiliar team, we can consider commonly missed dynamics before finalizing the initial portfolio.

**Acceptance criteria**

- An optional prompt presents concise lenses such as regulatory, technical, user adoption, quality, commercial/distribution, service/support, funding, and team dynamics.
- The prompt does not require categorizing every assumption.
- Users may add candidates or explicitly continue without doing so.
- The prompt is educational rather than presented as proof of completeness.

## Epic E4 — Assessment and portfolio visualization

**Outcome:** The team can assess assumptions and see which deserve the most attention.

### E4-S1 — Assess consequence if wrong

As a project member, I can place an assumption on the horizontal dimension.

**Acceptance criteria**

- The scale represents only consequence if wrong.
- Guidance explains the progression from manageable change to strategic change to potentially project-ending consequence.
- A 0–100 stored scale is available without implying exact scientific precision.
- Assessment can be completed without typing an exact number.

### E4-S2 — Assess evidence supporting validity

As a project member, I can place an assumption on the vertical dimension.

**Acceptance criteria**

- Guidance ranges from reasonable guess or weak support to evidence-based proof of validity.
- The interface explains that contrary evidence can reduce support and move an assumption upward.
- The scale does not confuse amount of investigation with support for validity.
- A 0–100 stored scale is available without implying exact scientific precision.

### E4-S3 — View the assumption map

As a team, we can see the portfolio graphically and recognize assumptions needing attention.

**Acceptance criteria**

- Both dimensions and qualitative regions are clearly labeled.
- Each scored active assumption appears on the map.
- Selecting a point identifies the full assumption and selects it in the list.
- Visual collision handling does not alter stored scores.
- The view remains usable with approximately 12 assumptions.
- The most consequential, least-supported region is visually understandable without relying only on color.

### E4-S4 — View and prioritize the assumption list

As a project member, I can use a list when the chart alone is insufficient.

**Acceptance criteria**

- The list and chart reflect the same current data.
- Users can sort by consequence, support, recent change, and combined attention priority.
- Any combined priority ordering is explained and does not replace the two underlying dimensions.
- Selecting an item in the list selects it on the chart.
- Basic filtering does not obscure which project is active.

### E4-S5 — Edit scores directly

As a project member, I can directly change either score so the portfolio reflects current team judgment.

**Acceptance criteria**

- Direct edit is the default MVP behavior.
- Changes are immediately reflected in the list and map.
- Previous values are not overwritten in history.
- Optional rationale can be entered without being required.
- The user can cancel an in-progress change.

## Epic E5 — Assumption management and history

**Outcome:** Each assumption becomes a durable management record rather than a point on a chart.

### E5-S1 — View assumption details

As a project member, I can understand the current state and context of an assumption.

**Acceptance criteria**

- Detail includes statement, current scores, creator, current next step, help needed, and history.
- Merge/split/replacement lineage is visible when applicable.
- The full statement is readable even when chart labels are abbreviated or repositioned.

### E5-S2 — Record next step and help needed

As a project member, I can capture the team’s agreed response to an important assumption.

**Acceptance criteria**

- Next step and help needed are simple text fields.
- An optional responsible member and target date may be recorded.
- The feature does not grow into subtasks, dependencies, time tracking, or general project management.
- Changes are retained in history.

### E5-S3 — Preserve immutable assessment history

As a project member, I can understand how and why an assumption changed.

**Acceptance criteria**

- Each published score change records previous value, new value, actor, and timestamp.
- Optional rationale is preserved.
- Historical events cannot be silently edited or deleted through normal use.
- Current state can be derived from authoritative events or is atomically consistent with them.
- History supports later comparison between formal reviews.

### E5-S4 — Preserve assumption lineage

As a project member, I can follow assumptions that were merged, split, or materially replaced.

**Acceptance criteria**

- Superseded assumptions remain available in history but are excluded from the default active view.
- Successors and predecessors are linked.
- A lineage operation records actor, time, and explanation if provided.
- Normal users cannot permanently erase lineage.

## Epic E6 — Evidence

**Outcome:** Teams can preserve what they learned without making evidence administration a prerequisite for action.

### E6-S1 — Add an evidence entry

As a project member, I can record new evidence so the basis for team learning is not lost.

**Acceptance criteria**

- Evidence includes a description, contributor, and date.
- Users may classify it as supporting, contradicting, or informative/inconclusive.
- A source URL is optional.
- Evidence is appended rather than rewriting earlier evidence.
- Evidence is not required to change an assumption’s score.

### E6-S2 — Relate evidence to assumptions

As a project member, I can connect one evidence item to one or several assumptions.

**Acceptance criteria**

- At least one related assumption is required for project evidence in the MVP.
- One evidence item may relate to multiple assumptions.
- Evidence is visible from each related assumption.
- Removing a relationship does not silently destroy the evidence record or its history.

### E6-S3 — Reject or supersede evidence without rewriting it

As a project member, I can record that evidence is no longer accepted while preserving what the team previously considered.

**Acceptance criteria**

- Evidence can be marked rejected or superseded.
- The original content remains visible in history.
- The disposition records actor, time, and optional rationale.
- New evidence is added as a new entry rather than editing the substance of an older entry.

## Epic E7 — Formal reviews

**Outcome:** Continuous work can be interpreted at episodic review points.

### E7-S1 — Start a formal review

As a project member, I can begin a review of the current assumptions portfolio.

**Acceptance criteria**

- A review has a title or date and optional context.
- The review shows current state and changes since the preceding published review.
- The first review clearly indicates that no prior comparison exists.
- Starting a review does not freeze ordinary project work.

### E7-S2 — Review material changes

As a team, we can see what changed since the last formal review.

**Acceptance criteria**

- New, moved, consolidated, split, and administratively removed assumptions are identifiable.
- Score changes show old and current positions.
- Relevant evidence and next-step changes can be inspected.
- The MVP need not display arrows, trails, or animation.

### E7-S3 — Publish an immutable review snapshot

As a team, we can preserve what we formally understood at a review point.

**Acceptance criteria**

- Publishing records the portfolio state, review notes, publisher, and time.
- Published snapshots are immutable through normal use.
- Current project work continues after publication.
- Later reviews can compare against the published snapshot.
- Snapshot data is sufficient for later movement visualization and analytics.

## Epic E8 — Essential notifications and return engagement

**Outcome:** Members learn about important project activity without requiring constant monitoring.

### E8-S1 — Notify an invited user

As an invited user, I receive enough information to accept or decline project access securely.

**Acceptance criteria**

- Invitation email identifies the application and inviter.
- Project details are limited until the intended recipient verifies identity.
- Expired or revoked invitations cannot be accepted.

### E8-S2 — Provide in-app project activity notifications

As a project member, I can see significant changes since my last visit.

**Acceptance criteria**

- Initial events are limited to meaningful changes such as material score changes, evidence added, review published, and assignment of a next step.
- Notifications identify the project clearly.
- Users can mark notifications read.
- The system avoids notifying the actor about their own action unless useful.

### E8-S3 — Add minimal email notification controls

As a project member, I can receive useful email without excessive noise.

**Acceptance criteria**

- Security and invitation emails remain transactional.
- Project activity email is limited to an agreed initial event set or digest.
- Users can disable nonessential project-activity email.
- Email content does not expose more project information than appropriate.

## Epic E9 — Production readiness and MVP validation

**Outcome:** The product is safe and understandable enough for unfamiliar pilot teams.

### E9-S1 — Validate critical workflows

**Acceptance criteria**

- Automated tests cover authentication boundaries, project isolation, invitations, assumption changes, history, evidence relationships, and review publication.
- Representative end-to-end tests cover the main MVP journey.
- Error and empty states are understandable.
- Accessibility checks cover keyboard use, labels, contrast, and non-color interpretation of the chart.

### E9-S2 — Validate with unfamiliar pilot teams

**Acceptance criteria**

- At least one team attempts guided setup without direct facilitation.
- At least one facilitated team uses the app in a real or realistic session.
- Observations distinguish methodology confusion from UX problems.
- Blocking findings are resolved or consciously accepted before broader release.

### E9-S3 — Establish operational readiness

**Acceptance criteria**

- Development and production data are separated.
- Deployment and rollback procedures are documented and tested at an appropriate level.
- Error monitoring and basic operational logging exist.
- Security rules are deployed and verified with the application.
- Backup, retention, and recovery expectations are recorded.

---

# 7. Recommended delivery slices

Each slice is a **vertical slice**: it crosses user experience, data, security, backend behavior, automated testing, and documentation where applicable.

## Slice 1 — Walking skeleton

- Application baseline
- Account creation and sign-in
- Private project creation
- Project selector and active project shell
- One persistent basic assumption
- Project-isolation tests
- Development deployment

**Demonstrable result:** Two users can sign in, create separate projects, and neither can discover or access the other’s basic assumption.

## Slice 2 — Membership and collaboration

- Invitations
- Invitation acceptance
- Member list
- Member removal
- Multiple owners and ownership transfer
- Authorization and audit tests

**Demonstrable result:** A project owner invites a collaborator, who joins that project without gaining access elsewhere.

## Slice 3 — Promises and guided start

- Three promise statements
- Guided versus direct entry
- Resumable wizard shell
- Core methodology guidance

**Demonstrable result:** An unfamiliar user can create project context and understand the assessment steps.

## Slice 4 — Candidate workshop

- Rapid candidate entry and bulk paste
- Affirmative-language coaching
- Edit, merge, split, discard, and adopt
- Portfolio-size guidance
- Static blind-spot prompts

**Demonstrable result:** A team can turn raw workshop ideas into approximately 12 active affirmative assumptions.

## Slice 5 — Initial assessment and map

- Both scoring interactions
- Assumption map
- Synchronized prioritized list
- Collision handling
- Direct editing

**Demonstrable result:** A team can score its active set and recognize the upper-right assumptions needing attention.

## Slice 6 — Management record and history

- Assumption detail
- Next step and help needed
- Optional owner and target date
- Immutable score/change history
- Lineage display

**Demonstrable result:** The team can update the portfolio over time without losing prior state or rationale.

## Slice 7 — Evidence

- Append evidence
- Relate evidence to multiple assumptions
- Supporting, contradicting, or informative classification
- Reject/supersede without rewriting

**Demonstrable result:** One learning event can inform several assumptions and remain auditable over time.

## Slice 8 — Formal review

- Start review
- Compare with previous published review
- Review notes
- Publish immutable snapshot

**Demonstrable result:** A team can work continuously and later preserve an episodic assessment of what changed.

## Slice 9 — Notifications and pilot readiness

- Invitation email
- Minimal in-app notifications
- Limited email preferences or digest
- Accessibility and unfamiliar-team testing
- Production deployment and operational baseline

**Demonstrable result:** Pilot teams can adopt, return to, and safely use the application.

---

# 8. Technical enablers

These should be implemented only when required by a vertical slice.

## TE-1 — Project-scoped authorization

- Every protected record has an unambiguous project owner.
- Client rules and backend checks use active membership.
- Nonmembers cannot discover project metadata.

## TE-2 — Atomic current state and immutable events

- A meaningful change updates current state and appends its event atomically.
- History cannot disagree with current state because of a partial write.
- Events contain stable actor identifiers and timestamps.

## TE-3 — Review snapshot strategy

- Decide whether snapshots store complete denormalized state or a stable event position from which state can be reconstructed.
- Optimize for reliable historical display rather than theoretical purity.
- Ensure later trajectory visualization remains possible.

## TE-4 — Assumption lineage

- Support predecessor and successor relationships.
- Prevent cycles or invalid cross-project lineage.
- Preserve superseded records.

## TE-5 — Accessible charting

- Select a charting approach capable of scatter placement, labels, selection, collision treatment, keyboard access, and non-color cues.
- Validate the library through a focused spike before deep UI investment.

## TE-6 — Invitation and email delivery

- Use server-authorized invitation creation and acceptance.
- Prevent email-address substitution.
- Define transactional sender and development-safe email behavior.

## TE-7 — Testing strategy

- Unit tests for pure scoring and lineage rules.
- Emulator-backed integration tests for Firestore rules and functions.
- Targeted component tests for complex interactions.
- A small number of end-to-end tests for critical journeys.

## TE-8 — Event vocabulary

- Define stable event types for scoring, wording, promises, lineage, evidence, next steps, membership, and review publication.
- Avoid treating raw database changes as meaningful business events.

---

# 9. Spikes

A **spike** is a time-boxed investigation that resolves an uncertainty without committing to production implementation.

## SP-1 — Chart interaction and collision handling

Evaluate candidate React charting approaches using approximately 12 labeled points, overlapping coordinates, selection synchronization, qualitative background regions, and keyboard accessibility.

**Exit evidence:** A disposable prototype and recommendation with identified limitations.

## SP-2 — Review snapshot design

Compare full snapshots with event-based reconstruction for reliability, query simplicity, storage, and future movement visualization.

**Exit evidence:** A short architectural decision record and sample data shape.

## SP-3 — Affirmative-language coaching

Test whether simple rules and examples provide useful coaching without AI or excessive false warnings.

**Exit evidence:** Recommended MVP behavior and examples; AI remains out of scope.

## SP-4 — Notification event set

Use pilot workflows to identify which events merit immediate notification, digest inclusion, or no notification.

**Exit evidence:** Initial event/channel matrix before building broad notification preferences.

---

# 10. Deferred backlog

## Governance and permissions

- Optional proposed-change and review workflow modeled conceptually on a GitHub pull request
- Project-configurable direct, notify, or review change modes
- Editor, reader, reviewer, facilitator, publisher, and approver permissions
- Organization-level administration separated from project-content access

## Decision and milestone management

- Milestone records
- Explicit proceed, mitigate-and-proceed, conditionally proceed, or do-not-proceed decisions
- Accepted unresolved risk records
- Contingency plans, monitoring triggers, and approval history
- Qualitative or quantitative comparison of validation cost with risk-adjusted cost of proceeding

## Analytics and visualization

- Assumption movement arrows from review to review
- Multi-review traces, animation, or time slider
- Congestion-management controls for historical trajectories
- Risk-retirement analytics distinguishing supported, contradicted, mitigated, accepted, and newly discovered risk
- Cross-project portfolio reporting

## AI assistance

- Portfolio blind-spot analysis
- Suggested candidate assumptions
- Detection of compound, vague, circular, or contradictory assumptions
- Affirmative rewording suggestions
- Evidence summarization
- AI suggestions always require user acceptance and never silently change project content or scores

## Integrations and extensibility

- Miro import or integration
- External task-management links
- Advanced exports and leadership/board reporting
- Custom labels, thresholds, scales, and promise terminology
- Project templates and domain-specific guidance

## Lifecycle and administration

- Formal project closeout
- Archive and reopen semantics beyond minimal archive
- Retention policies and controlled permanent deletion
- Dedicated infrastructure for exceptional contractual or regulatory requirements

---

# 11. Decision log

## Settled for MVP

- Use the canonical term **Investor Promise**.
- Do not require formal assumption-to-promise mapping.
- Use a shared database and application with project-level isolation.
- Do not create a stable team entity; the project membership list is the team.
- Anyone may create a project.
- Direct score changes are the default.
- Preserve immutable score history.
- Evidence is not required for a score change.
- Evidence may apply to several assumptions.
- Do not build a general task-management system.
- About 12 active assumptions is guidance, not a limit.
- Use 0–100 stored scales unless later UX testing identifies a better representation.
- Do not customize labels or thresholds in the MVP.
- Preserve review history needed for future movement visualization.

## Resolve during refinement

1. Exact qualitative labels and thresholds displayed on each axis.
2. Whether the first formal review simply publishes the initial assessment or follows a separate initial-publication action.
3. Minimum contents of an evidence record and whether source URLs are included in the first evidence slice.
4. Whether responsible person and target date are MVP fields or the first post-MVP extension of next steps.
5. Immediate versus digest notification behavior.
6. Minimal archive behavior before formal closeout is designed.
7. Final product name and public-facing terminology outside the established methodology terms.

---

# 12. Recommended first implementation assignment for Codex

> Build Slice 1, the walking skeleton. Establish the React/Vite/Ant Design application and Firebase development configuration. Implement verified authentication, private project creation, a project selector, an unmistakable active-project shell, and creation/readback of one basic assumption. Enforce active project membership through Firestore security rules and add emulator-backed tests proving that authenticated nonmembers cannot discover, read, query, or write another project’s data. Do not add invitations, guided setup, promises, scoring, charting, evidence, notifications, organization roles, or formal reviews.

Before giving this assignment to the coding agent, refine Slice 1 into repository-specific implementation tasks and agree on its manual acceptance procedure.
