# MVP status — feature baseline accepted

The user accepted Slice 3C. The planned feature sequence through reporting is complete and accepted. This is the baseline for subsequent adjustments. Pilot and production operational acceptance are distinct from feature acceptance; unobserved checks below are not marked passed.

| Area                       | Delivered and accepted                                                           | Remaining                                                                          |
| -------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Accounts                   | Google sign-in, explicit linking, retained email/password                        | New-tester/mobile OAuth check                                                      |
| Projects and collaboration | Isolated projects, copyable recipient-bound invitations, membership removal      | Complete multi-account pilot journey                                               |
| Portfolio                  | One synchronized list/chart, drawer, sorting, guarded drafts and conflicts       | Cross-device and keyboard acceptance                                               |
| Promises and learning      | Immutable wording, score, insight, next-step/help history with attribution       | Earlier missing history cannot be reconstructed                                    |
| Setup and candidates       | Optional dedicated guide, candidate capture and adoption with initial scores     | Unfamiliar-team trial; invitation step is backlog                                  |
| Reviews                    | Optional formal reviews, immutable saved reviews, review comparisons             | Individual acceptance/rejection is deferred                                        |
| Reporting                  | Current or saved-review source, one-page brief, optional since-review comparison | Browser/PDF layout checks across representative projects                           |
| Operations                 | Source release and deployment instructions; automated checks                     | Recovery drill, environment separation and monitoring acceptance before production |

## Verification for the accepted baseline

- 132 application tests and 79 Firestore rules/service tests passed in Slice 3C.
- Formatting, lint, and production build passed in Slice 3C.
- No application code changes in this closeout; those results remain applicable.
- Google Auth emulator linking checks are recorded in [Pilot readiness](Pilot-Readiness.md).
- User acceptance does not establish completion of every browser, accessibility, or recovery check. The earlier browser service blocked the local preview URL; no new visual result is claimed.

## What comes next

Use the short [pilot checklist](Pilot-Readiness.md), record findings, then make bounded adjustments. No production deployment has been performed. Custom SMTP delivery remains deferred; Google is the primary onboarding path and project contact is mullenpaull@gmail.com.

Retained backlog:

- Owner-authorized, expiring and revocable read-only support access, with a project reference, contact details, access history, and future support-role delegation. Replaces blanket administrator read-all access.
- Optional invitation step in guided startup, with Skip for now and a way to invite later.
- Standalone snapshots without formal reviews.
- Individual change acceptance/rejection and an accepted baseline.
- Miro-like organization versus Miro integration, merge/split, richer lifecycle, notifications, ownership transfer, and cross-device guide progress.

The [next sprint plan](Next-Sprint-Plan.md) retains the detailed scope. Historical slice notes describe their original delivery state; this document is the current status.

## Adjustment after the accepted baseline

Candidate grouping is the user's top priority. The approved board mockup is implemented and awaiting user/visual acceptance. Named groups, order, atomic combination with preserved source records, and existing scored adoption are included. See [Candidate grouping board](Candidate-Grouping-Board.md). This approved combination slice supersedes blanket merge deferral; split and broader lifecycle remain deferred. Deploy Hosting and rules together.

The candidate grouping board was accepted by the user. Guided team invitations and the optional movement-since-review portfolio overlay are now implemented for review. These supersede their earlier backlog entries. See [Invitations and movement](Invitations-and-Review-Movement.md); updating from the candidate board requires Hosting only.
