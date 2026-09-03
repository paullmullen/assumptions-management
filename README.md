# Assumptions Management

The current application includes verified authentication, isolated private projects, the Three Promises, affirmative assumptions, two-axis scoring, and a synchronized portfolio chart. The chart plots only fully assessed assumptions, keeps unassessed work distinct, and shows the highest unretired risk in the upper-right using labeled diagonal attention bands over the 3×3 qualitative grid.

## Portfolio workspace

Portfolio is the default project view. Use **Three Promises** above it to expand the promises, **Candidates** to capture/adopt ideas, **Reviews** for formal snapshots, and **Settings & access** for project information and owner-only access controls. The approved [next sprint plan](docs/Next-Sprint-Plan.md) is the plan of record.

There is one active-assumption list beside the chart. Selecting a chart point or list row opens the same immediately editable right-side drawer for wording, scores, insights, next steps, help needed, and history. Unassessed items stay in the list and off the chart until scored. Save changes commits all changed fields and score/management/insight history atomically. Add assumption uses the same drawer, with optional initial scores and supporting fields.

Closing/Escape, changing selection or project, signing out, and in-app browser Back/Forward protect unsaved work. Failed saves and conflicts retain the draft. A conflict shows latest saved values and requires explicit review before saving again. Revert requires confirmation. Browser refresh/close requests the native unsaved warning when supported; drafts are not crash recovery or offline persistence.

See [Slice 1B delivery and acceptance checks](docs/Workspace-Slice-1B.md). **Deploy Hosting and Firestore rules together for this slice**, especially before creating assumptions with initial insights/management fields. The development deployment command below includes both. No production dependency was added. Immutable wording/promise history remains a later goal; current history covers insights, score changes, and next-step/help changes.

Use **Sort assumptions** above the list to order by consequence, evidence, recent change, or attention priority (criticality minus evidence). Chart numbers and the open drawer stay attached to the same assumptions. History is labeled **Newest first** with separated entries. See [Slice 1C](docs/Workspace-Slice-1C.md); updating from 1B requires Hosting only.

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

## Optional formal reviews (Slice 2A)

New projects default to reviews off, with an explicit creation choice. Owners can change **Use formal reviews** in **Settings & access**. Existing projects stay enabled; turning reviews off preserves prior snapshots and ordinary history. Deploy Hosting and Firestore rules together. See [Slice 2A](docs/Workspace-Slice-2A.md) for details and acceptance checks.
