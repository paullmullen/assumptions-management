# Assumptions Management

The current application includes verified authentication, isolated private projects, the Three Promises, affirmative assumptions, two-axis scoring, and a synchronized portfolio chart. The chart plots only fully assessed assumptions, keeps unassessed work distinct, and shows the highest unretired risk in the upper-right using labeled diagonal attention bands over the 3×3 qualitative grid.

## Chart and list selection

Select a numbered chart point, chart-key entry, or the saved list's “Select assumption” button to highlight the same assumption throughout. The selected area below the chart immediately shows editable criticality and evidence fields, without an extra “Update scores” click or scrolling to the saved list. “Save scores” refreshes both views; “Revert changes” restores saved values. Unsaved drafts persist while switching selections within the current project. Selection and typing do not write to Firestore. Failed saves retain edits for retry. Unassessed assumptions selected in the saved list can be scored here too; they remain off the chart until saved. Switching projects clears selection and drafts. The existing saved-list editors remain available.

Manual check: select a point and edit evidence in the selected area. Switch to another point and back to confirm the draft remains. Save and confirm the point moves. Repeat with “Revert changes” and switch projects to verify isolation. Selection alone must not move or scroll the chart.

## Development setup

Prerequisites: Node.js 22+, Java (required by the Firestore emulator), and Firebase CLI authentication only when deploying. This repository uses the dedicated Firebase development project `assumptions-management` in Firestore location `nam5`. Production must use a separate Firebase project and is not configured in this slice.

1. Install dependencies:

   ```powershell
   npm.cmd install
   ```

2. In Firebase Console, add a **Web app** to `assumptions-management` if one does not already exist. Copy its configuration values into a new `.env.local`, based on `.env.example`.

3. Start emulators in one terminal:

   ```powershell
   npm.cmd run emulators
   ```

4. In another terminal, start the app:

   ```powershell
   npm.cmd run dev
   ```

The app uses Auth and Firestore emulators when `VITE_USE_FIREBASE_EMULATORS=true`. Firebase Auth Emulator prints a verification link to its logs. Open that link, then sign in again so the app reloads the user and force-refreshes the ID token with the `email_verified` claim. Registration sends the Firebase verification email immediately after account creation; unverified users can request another from the verification screen. In deployed development, both actions use Firebase's default hosted action handler.

## Checks

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run test
npm.cmd run test:rules
npm.cmd run build
```

`npm.cmd run check` runs format, lint, unit/component tests, and the build. The Firestore rules suite starts its own isolated Firestore emulator on port 8081, so it does not clear data in the emulator used for local application work.

## Development deployment

The shared development site is the default Hosting site: `https://assumptions-management.web.app`.

1. Sign in with a Google account that has permission to deploy Firebase Hosting and Firestore rules in the `assumptions-management` project:

   ```powershell
   npm.cmd exec firebase login
   ```

2. Build and deploy Hosting plus rules only:

   ```powershell
   npm.cmd run deploy:development
   ```

No Cloud Functions are deployed in Slice 1. Firebase's default hosted authentication action handler sends verification and password-reset emails; no custom email infrastructure is used.

## Security model

The project is the tenant boundary. Firestore rules require a verified user with an active membership for each project read or write. Project creation is one client-side atomic batch that creates both the project and the creator's owner membership. Rules use `getAfter()` and `existsAfter()` to require the matching pair.

Existing project documents and membership records are never client-editable in Slice 1. This keeps project creator identity, membership user ID, membership project ID, owner designation, and active status immutable. The Firebase Emulator rules tests prove atomic creation and reject fraudulent ownership and cross-project access.
