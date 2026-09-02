# Next step and help needed

The selected assumption's existing editor now includes two optional fields:

- **Next step:** What will we do to investigate, validate, or mitigate this assumption?
- **Help needed:** What assistance or resources would help?

Both are plain text, up to 4,000 characters each. They are current, editable values, unlike the appended New insight note. The same **Save changes** button saves either field, both fields, scores, an insight, or any combination. Neither scores nor an insight are required. Unassessed assumptions can have next steps and help needed without being plotted.

Saved values remain in the editor. Clear a field and save to remove its current value. Changes—including clearing—appear under **Recorded insights and changes**, with previous/new text, author, and server timestamp. Empty values display as **Not set**. Drafts stay with their assumption while switching selections, clear when changing projects, and remain after failed saves. Revert restores the saved values.

## Data and security

Current values are stored as `nextStep` and `helpNeeded` on the assumption. Legacy assumptions treat absent values as empty strings. The editor submits only changed fields. The save transaction reads the latest assumption and preserves the other field if it was not edited.

Each change creates an immutable record in the existing `insights` subcollection, with `managementChange.from` and `managementChange.to` containing both fields. `lastManagementChangeId` on the assumption links to that record. Combined score/management/insight saves create one record and commit atomically. Rules reject invalid values, missing or forged history, unauthorized access, and history edits/deletions. No new dependencies, indexes, or Cloud Functions are needed.

Responsible person, target date, task lists, and broader project-management features remain deferred. Chart layout, axes, and standalone insight behavior are preserved.

## Deploying and checking locally

This release includes updated Firestore rules. From the extracted project directory, deploy them when ready:

```sh
firebase deploy --only firestore:rules --project assumptions-management
```

No deployment was performed for this delivery.

Run `npm run format:check`, `npm run lint`, `npm test`, `npm run test:rules`, and `npm run build`.

Manual acceptance:

1. Select an unassessed assumption; save only Next step and Help needed. Confirm scores stay empty and the assumption stays off the chart.
2. Reload; confirm both fields persist.
3. Change and clear fields; confirm previous/new text, author, and timestamp appear in history.
4. Save fields together with an insight and a score change. Confirm there is one combined record.
5. Change selections with unsaved text, return, and use Revert. Switch projects to check isolation.
6. Simulate a failed save; confirm the fields retain their draft values.

Manual browser acceptance remains for local review; no deployed application was tested.

## Delivery validation

Formatting and lint passed. All 34 application tests and 34 Firestore emulator tests passed. Production build passed with the existing large-bundle warning.
