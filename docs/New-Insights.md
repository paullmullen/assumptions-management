# New Insights MVP slice

Select an assumption from the chart or saved list to open the single editor below the chart. The list's **Update scores** and **Assess** buttons focus this same editor. There is one insight input and one **Save changes** action. The separate card below it shows recorded insights and changes, including score history and [next step/help needed](Next-Step-and-Help-Needed.md).

Save accepts any of these:

- An insight alone, with scores unchanged—even if the assumption has never been scored.
- A score change alone, with no insight required.
- Both an insight and score changes, committed atomically.

An insight alone does not write to the parent assumption, change its scores, or alter its update timestamp. When edited scores are incomplete or invalid, restore them or finish both scores before saving; the application does not silently discard score edits. Whitespace-only notes do not enable Save. A source URL and classification (Evidence, Revised judgment, or Mitigation / project change) remain optional. Optional metadata requires a description when it is saved without a wording, score, or management change; classification can explain one of those changes without a separate description.

Author and date are recorded automatically. The visible username is the signed-in account email, with UID and a server timestamp for attribution. Recorded insights appear newest first. Loading the history is independent of enabling Save. Permission-denied errors are distinguished from general failures, and failed saves retain drafts.

The vertical axis remains strength of supporting evidence. A nonblocking reminder appears when an existing criticality changes; initial assessment and evidence-only changes do not show it. Scoring guidance is available within the single editor. No confirmation click is added.

Drafts stay with their assumption during selection changes and clear when switching projects. Insights are append-only; corrections can be recorded as another insight. Multi-assumption relationships, rejection/supersession, historical review comparisons, dragging, and visual polish remain deferred.

## Data and authorization

Path: `projects/{projectId}/assumptions/{assumptionId}/insights/{insightId}`.

Required fields: `description` (nonblank, maximum 4,000 characters), `createdBy` (authenticated UID), `authorEmail` (authenticated email snapshot), and `createdAt` (server timestamp). Optional fields: `sourceUrl` (HTTP/HTTPS, maximum 2,000 characters) and `classification` (one of the three labels above). The UI displays the author email and localized date/time.

Firestore rules allow reads and creates only for verified active project members, require an existing parent assumption, enforce attribution and server date, reject unexpected fields, and prohibit updates/deletes. No new indexes, production dependencies, or Cloud Functions are needed. This release updates the rules to validate score-change history. Deploy these rules with this application version; older app versions cannot change scores under the new rules.

## Troubleshooting access to insights

If assumptions load but insights are denied, older deployed rules may lack the nested insights match. The screenshot's earlier generic message alone cannot establish the cause. Confirm a `permission-denied` error, verify the signed-in user's active project membership, and check that the target Firebase project has this archive's `firestore.rules`.

A local source change does not deploy rules. When authorized, deploy the included rules from this project directory with:

```sh
firebase deploy --only firestore:rules --project assumptions-management
```

Reload the app after deployment. No deployment was performed for this delivery.

## Verification and manual acceptance

Run `npm ci`, `npm run format:check`, `npm run lint`, `npm test`, `npm run test:rules`, and `npm run build`. Rules tests require Java and the Firestore emulator.

1. Select an assessed assumption, enter only an insight, and save. Confirm the score values do not change.
2. Repeat for an unassessed assumption. Scores stay empty and the assumption stays off the chart.
3. Change either score with and without an insight. Confirm the same Save action handles all cases.
4. Use Update scores or Assess from the list. Confirm there is still exactly one insight input and one Save changes button.
5. Reload and confirm description, author, timestamp, optional source, and optional classification.
6. Change criticality to see the reminder; revert to remove it. Change only evidence and confirm no reminder appears.
7. Switch assumptions with drafts and return; switch projects to clear drafts and old history.
8. Simulate failed loading and saving; verify retry, retained drafts, and distinct access-denied messages.

Manual browser acceptance steps remain for local review; no deployed application was tested.

## Delivery validation

Formatting and lint passed. Application tests: 34 passed across 7 files. Firestore emulator tests: 34 passed, including insight-only writes for assessed and unassessed assumptions, attribution, access isolation, and atomic failure. Production build passed with the existing large-bundle warning. Chart SVG and stylesheet are unchanged.

The Three Promises form now remains mounted under a loading indicator and disables editing while loading. This avoids populating a disconnected Ant Design form. Switching projects resets that form, and late responses from a previous project are ignored. Regression tests cover loading, saving, and project switching.

## From/to score history

Each actual score change appends a record with `scoreChange.from` and `scoreChange.to`, each holding criticality and evidence. The UI displays both axes, marking an unchanged axis explicitly. Null previous values display as **Not assessed**. A score-only record needs no description. When an insight accompanies the change, both appear in the same record with author and timestamp. A no-op score submission creates no change record; an accompanying insight is still saved without score-change metadata.

The transaction reads the current assumption before writing, so the from-values reflect the stored baseline. The assumption's `lastScoreChangeId` links to the new record. Rules require a matching new record with every score update and validate before/after values against the same atomic write. Records cannot be edited or deleted. A concurrent conflict can fail safely, retaining the user's draft for retry against the latest baseline.

Existing insight records remain readable. Previously overwritten scores cannot be reconstructed and are not backfilled. Score history begins with changes made using this version. Rules deployment is required again for these new fields; no deployment was performed in this delivery.
