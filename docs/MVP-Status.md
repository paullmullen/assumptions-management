# MVP status — 2026-09-02

This reconciles the current source with the original backlog. Implemented does not imply every acceptance criterion in an epic is complete. The user has reported that basic formal reviews and collaboration work in the deployed development app; visual polish remains open.

| Area                     | Current evidence                                                                                                                          | Remaining work                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation and isolation | Verified-account flow, project creation/switching, membership rules and automated tests                                                   | Final complete workflow and operational acceptance                                                                                           |
| Collaboration            | Email-addressed copyable invitations, acceptance, expiration, revocation, removal; user reports working                                   | Multiple owners and ownership transfer; automatic invitation email                                                                           |
| Three Promises           | Editable and preserved in review snapshots                                                                                                | Every-edit immutable promise history is absent; current save overwrites the brief                                                            |
| Guided start             | Optional five-step guidance, existing-editor navigation, browser-local resume, static blind-spot prompts                                  | Unfamiliar-team usability acceptance; no cross-device progress synchronization                                                               |
| Candidate workshop       | Separate pending candidates, multiline entry, wording edits, explicit adoption, attribution, affirmative guidance, portfolio-size warning | Merge/split lineage, discard/entered-in-error lifecycle                                                                                      |
| Assessment               | Two-axis scoring, synchronized selection, chart and score editor                                                                          | User-controlled sorting by consequence, support, recent change, and attention priority is absent                                             |
| Learning and management  | Insights, source URL/classification, score history, next step/help history                                                                | Multi-assumption insight relationships and supersession were deferred by the learning slice; statement edits lack per-edit immutable history |
| Formal reviews           | Compare saved state, notes, publish/reopen immutable snapshots; user reports working                                                      | Candidate lineage comparison depends on candidate implementation                                                                             |
| Notifications            | Copyable invitations support manual sharing                                                                                               | Invitation delivery, activity notifications, notification preferences remain original backlog items                                          |
| Pilot/release            | Automated application/rules checks and development deployment workflow                                                                    | Unfamiliar-team, accessibility, full multi-account return journey, and operational/production readiness acceptance                           |

Candidate capture and explicit adoption are now implemented; existing working assumptions are preserved. The next proposed bounded slice is candidate consolidation with merge/split lineage and retained superseded records. The remaining original requirements should stay visible until implemented or explicitly removed from MVP scope; they have not silently become post-MVP work.

## Verification for this guidance delivery

- Formatting, lint, application tests, production build, and Firestore rules regression suite.
- No security schema change or new production dependency.
- Manual guidance acceptance is listed in [Guided start](Guided-Start.md).
- This audit is a source reconciliation, not a claim of complete production readiness.
