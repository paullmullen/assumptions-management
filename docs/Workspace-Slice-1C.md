# Slice 1C — Useful portfolio sorting

The portfolio list now offers assumption number (the default), attention priority, consequence highest first, evidence weakest first, and recent change newest first. Sorting changes row order only: chart reference numbers, the selected assumption, and unsaved drawer fields remain stable.

## Agreed attention rule

The user selected “Match chart”: criticality minus evidence, highest first. This follows the chart’s diagonal risk direction; it is a discussion aid, not an expected-loss calculation. Both scores remain visible. Unassessed assumptions appear first as assessment work, without assigning them a numerical priority. Equal priorities retain assumption-number order. Consequence and evidence sorts also put unassessed assumptions first; zero is a valid score.

## Recent activity

Recent change includes the latest recorded creation/update timestamp or insight timestamp for each assumption. This covers wording, score and management updates and older insight-only saves without a migration. History reads are performed only when recent sorting is selected, using existing member-authorized reads. Failed history reads show an explicit retry and assumption-number order rather than a partial ranking. Unknown dates appear last.

Successful saves in this session move the assumption into recent order immediately using the local acknowledgement time. On reopening the project, persisted timestamps determine order. Reviewing a conflict does not count as saving a change. This is a loaded view of the project, not a new live collaboration subscription. Reading all insight history per assumption is acceptable for the small MVP portfolio; consider a server-maintained activity summary if history volume grows materially.

History entries now have separators and spacing, plus a “Newest first” hint. The complete drawer and the previous chart sizing correction remain included.

## Verification and deployment

Automated checks cover sorting direction, ties, zero/missing scores, stable chart references and selection, retained unsaved drafts, recent insight-only activity, post-save ordering, and failed-load retry. See the release response for final check results.

No services, Firestore rules, schema, functions, or dependencies changed. Upgrading from 1B or its chart fix requires only a Hosting rebuild/deploy. Upgrading from before 1B still requires the accompanying 1B Firestore rules. Nothing has been deployed by this task.

Browser visual acceptance remains pending: the browser service could not reach the local preview in this environment. In the running app, check each sort with the drawer open, save an insight without changing scores, reopen the project to verify recent order, and inspect history spacing at desktop and phone widths.

Next: Slice 2A — optional formal reviews, including an owner-controlled project preference and preserved access to previous snapshots.
