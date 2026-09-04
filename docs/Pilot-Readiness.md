# Pilot readiness — accepted MVP baseline

Feature status: accepted through Slice 3C. This package closes the planned feature sequence and collects the remaining pilot checks. It does not certify production readiness. No deployment, invitation delivery, production configuration change, or backup operation was performed during closeout.

## Quick start for a tester

Use the development app at https://assumptions-management.web.app and choose Continue with Google. If Paul invited you, sign in with the intended account and open the invitation link. Ask Paul at mullenpaull@gmail.com for help. The app does not email invitation links automatically.

Create a disposable pilot project or join the provided test project. Open guided start if useful. Write the Three Promises, capture candidate assumptions, adopt one with consequence and evidence scores, then select it from the chart or list to add an insight, next step, and help needed. Save and return later to check the result. With reviews enabled, save a review; otherwise keep editing normally. Project brief can show current saved data or a saved review. Review snapshots preserve status and do not imply approval.

## End-to-end acceptance record

Use an owner account, a second account in another browser profile, and a separate private project. Record browser/device, date, pass/fail, and a short observation for each row. All rows below are pending observed end-to-end completion; automated coverage and prior user reports are supporting evidence, not substitutes.

| Check                        | Expected result                                                                                                                                                   | Result  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Sign in and return           | New Google user can enter; signing out/in retains the same projects                                                                                               | Pending |
| Guided project setup         | Unfamiliar tester can create a project, enter promises and resume the guide                                                                                       | Pending |
| Invite and collaborate       | Owner shares an addressed link from Settings & access; recipient accepts, contributes, and attribution persists after reload                                      | Pending |
| Scored candidate adoption    | Cancel leaves candidate pending; save creates one scored assumption; zero is valid                                                                                | Pending |
| Insight without score change | A new description saves once with author/time, without forcing score changes                                                                                      | Pending |
| Wording history              | Assumption and promise revisions retain before/after text and author/time                                                                                         | Pending |
| Draft protection             | Closing, selecting another assumption, switching project, and navigation preserve or explicitly discard drafts                                                    | Pending |
| Conflict and failed save     | Two profiles edit the same assumption; stale save retains draft for conflict review. A failed network save retains unsaved work; retry does not duplicate history | Pending |
| Both review modes            | Toggle off/on and reload; setting sticks. Off preserves old reviews; on allows a new saved review                                                                 | Pending |
| Changes since review         | Make several score edits, add an insight, revise wording/promise, and adopt an assumption; brief shows net scores, correct counts and baseline date               | Pending |
| Report source and return     | Historical source excludes newer changes; reload after sign-in retains source data; no baseline reads No previous review                                          | Pending |
| PDF and long text            | Comparison on/off and zero/four discussion rows print legibly on one Letter landscape page; oversized content blocks export                                       | Pending |
| Isolation and removal        | Second account cannot open unrelated project. Removal closes online project and blocks future server access; prior attribution remains                            | Pending |
| Keyboard and narrow screen   | Focus is visible; drawer focus/return, labels, chart numbers and unsaved dialog work without a mouse; no inaccessible controls on a phone                         | Pending |

Use a disposable project for failure/removal checks. Turning off the network is a test of error handling, not an offline-editing feature. Do not refresh/close a browser to test a network failure: unsaved drafts are not crash recovery. Information already read, downloaded, or printed cannot be revoked.

## Evidence and release record

| Evidence                                            | Status                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Feature acceptance through 3C                       | User accepted                                                                         |
| Application regression                              | 132 passed in 3C; no application changes in closeout                                  |
| Firestore rules/service regression                  | 79 passed in 3C, including outsider and removed-member report/history denial          |
| Formatting, lint, production build                  | Passed in 3C; closeout documentation formatting checked separately                    |
| Google account-linking Auth emulator                | 3 passed during closeout; synthetic Google credentials, not a real OAuth browser test |
| Actual browser/OAuth, mobile, PDF and accessibility | Not fully observed; pending checklist                                                 |
| Operational recovery                                | Not demonstrated; pending below                                                       |

## Deployment and rollback handoff

This documentation-only package requires no deployment over 3C. Keep the previous accepted ZIP and the matching local environment configuration. ZIPs exclude local environment files, dependencies, build output, and secrets.

For a 3B to 3C application update, use the existing local Firebase configuration, build, and deploy Hosting only. For an older baseline, follow the relevant slice instructions; in particular 3A requires matching Hosting and Firestore rules. Use an explicit Firebase project when releasing; the current development project is assumptions-management. The repository does not configure a separate production project.

Existing PowerShell workflow for a Hosting update:

```powershell
npm.cmd ci
npm.cmd run build
npx.cmd firebase deploy --only hosting --project assumptions-management
```

Confirm the local configuration targets development, uses real Firebase rather than emulators for the deployed build, and retains VITE_AUTH_EMAIL_DELIVERY=firebase. Google provider setup is in [Google sign-in](Google-Sign-In.md). Do not deploy the deferred email Functions as part of this baseline.

If a frontend update causes a blocker, stop further rollout and retain the error details. Restore the prior accepted source in a separate directory, use its matching environment, rebuild, and redeploy Hosting to the same verified project. Confirm saved project data and sign-in still work. This restores application code, not Firestore data or Auth accounts. If rule/schema compatibility changed, assess it before reverting; do not loosen rules to make an older client work.

## Operations still to demonstrate before production

- Identify the production project separately from development and confirm who can deploy, support, and recover it.
- Agree what data loss and outage duration are tolerable, then establish backup retention and a documented recovery procedure covering project data and identity/membership dependencies. A source ZIP, saved review, and PDF are not a database backup.
- Demonstrate restoration in an isolated test environment and verify promises, assumptions, insights/history, saved reviews, and membership boundaries. Record recovery time and observed data loss. Do not experiment by restoring over the active pilot.
- Assign an owner for error reports and incident response. Record app version, browser, action, time, and sanitized error text; avoid collecting project content or credentials unnecessarily. Automated client error monitoring is not implemented by this closeout.
- Record pass/fail evidence for the checklist. Resolve lost work, unauthorized access, misleading report state, and inability to complete the workflow before wider use; track other findings as adjustments.

## Feedback format

Record: task attempted; expected result; actual result; browser/device; reproducible steps; severity (blocker or adjustment); owner; retest result. Separate difficulty understanding the method from difficulty using the interface. An unfamiliar team and a facilitated team should each try a realistic session.

Current handoff: accepted feature baseline, ready for pilot testing and bounded adjustments; not production sign-off.
