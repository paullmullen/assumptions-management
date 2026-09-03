# Assumptions Management

The current application includes verified authentication, isolated private projects, the Three Promises, affirmative assumptions, two-axis scoring, and a synchronized portfolio chart. The chart plots only fully assessed assumptions, keeps unassessed work distinct, and shows the highest unretired risk in the upper-right using labeled diagonal attention bands over the 3×3 qualitative grid.

## Chart and list selection

Select a numbered chart point, chart-key entry, or the saved list's “Select assumption” button to highlight the same assumption throughout. The selected area below the chart immediately shows editable criticality and evidence fields, without an extra “Update scores” click or scrolling to the saved list. “Save scores” refreshes both views; “Revert changes” restores saved values. Unsaved drafts persist while switching selections within the current project. Selection and typing do not write to Firestore. Failed saves retain edits for retry. Unassessed assumptions selected in the saved list can be scored here too; they remain off the chart until saved. Switching projects clears selection and drafts. The existing saved-list editors remain available.

Manual check: select a point and edit evidence in the selected area. Switch to another point and back to confirm the draft remains. Save and confirm the point moves. Repeat with “Revert changes” and switch projects to verify isolation. Selection alone must not move or scroll the chart.

## Project collaboration

Owners can create email-addressed invitation links, inspect members, revoke invitations, and remove access. Share the copied link with the intended person; their verified account can accept and work in the shared project. Invitation emails are not sent automatically. See [Project collaboration](docs/Project-Collaboration.md) for deployment, security, and two-account acceptance checks.

## Formal reviews

Use **Formal reviews → Start review** to inspect saved state and changes since the previous published review. Add notes and publish a preserved snapshot with publisher and time. Refresh saved state before publishing when needed. Earlier reviews remain unchanged while ordinary project editing continues. See [Formal reviews](docs/Formal-Reviews.md) for scope, limits, and acceptance checks. Deploy **both Hosting and Firestore rules** for this feature.

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

Project creator identity and the original owner designation remain immutable. Invited member records can be activated through a matching invitation acceptance transaction or deactivated by the owner with a matching roster update and removal event. Rules enforce these transitions and project isolation.

## Guided start and MVP status

The optional [guided start](docs/Guided-Start.md) is available inside each project. See the [MVP status audit](docs/MVP-Status.md) for implemented behavior and remaining requirements.

## Candidate workshop

[Candidate capture and adoption](docs/Candidate-Capture-and-Adoption.md) supports multiline candidate entry, wording refinement, and explicit adoption into the active portfolio. Deploy the updated Firestore rules with Hosting using the existing development deployment command.
