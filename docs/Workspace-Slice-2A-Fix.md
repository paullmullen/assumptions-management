# Slice 2A fix — Modal options and review preference feedback

Both application Modal instances now use `mask={{ closable: false }}` instead of deprecated `maskClosable`. Clicking outside still cannot dismiss a review or an unsaved-changes prompt.

The review preference listener ignores pending local writes and includes metadata updates so it receives the write acknowledgement. The switch retains the previously saved value while saving. Saving status is shown beside it. Save errors remain beside the switch and are no longer cleared by a rollback or unrelated project snapshot. Permission-denied errors identify owner access or deployed rules as possible causes.

## Why the switch can revert

Firestore can briefly emit a local change before rejecting the write. The previous UI could then clear its error on the subsequent snapshot. That error-handling defect is fixed.

The reported running-site rejection is not independently confirmed: deployed rules were not inspected. The included 2A rules permit active owners to update the preference, and emulator tests confirm disabling survives a new subscription. Earlier rules deny all project updates. If only Hosting was deployed for 2A, deploying its Firestore rules is necessary for this feature to work.

From the extracted project directory on Windows, deploy the app and rules together:

```powershell
npm.cmd run deploy:development
```

Or, if the app is already built/deployed and only its rules were omitted:

```powershell
npx.cmd firebase deploy --only firestore:rules --project assumptions-management
```

The full command uses the configured Firebase project; this package's default is `assumptions-management`. Refresh the app after deployment. Toggle reviews off, wait for “Saved preference: formal reviews off,” then reopen the project. If permission denied persists, verify that the signed-in user is the active project owner.

This patch does not weaken or modify the 2A security rules. No new dependencies. Nothing was deployed by this task.

## Verification

Regression coverage verifies that permission errors survive a rollback snapshot, successful retry clears the error, pending writes do not appear as saved preferences, and disabling remains off after resubscribing. Existing owner-only access, publication restrictions, and draft protection remain covered. Browser visual acceptance remains pending.
