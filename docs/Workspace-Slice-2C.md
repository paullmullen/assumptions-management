# Slice 2C — Dedicated guided experience

Google sign-in and linking were accepted by the user before this slice. Custom SMTP email delivery remains deferred. Project contact remains mullenpaull@gmail.com.

## Result

Open guided start now replaces the main work area with a focused guide rather than expanding guidance above the chart. The project context and workspace navigation remain available. The same dedicated layout is used on wide and narrow screens to avoid floating-guide and assumption-drawer focus conflicts.

The five method steps retain the Three Promises, affirmative assumptions and candidate adoption, blind-spot discussion, two-axis assessment, and learning/review guidance. Users can move forward/back or select any step directly. The last step adapts when formal reviews are disabled.

Each step opens and focuses the existing editor or section. Promises opens alone, without a previously selected assumption drawer. Candidates and the portfolio retain their usual editing and scoring behavior. Reopen guided start to return to the current step; Pause/Finish returns to the portfolio. Neither navigation nor finishing the guide saves project data or certifies completion.

The step is remembered locally per account/project, including progress from the previous guide format. The workspace still opens normally after a reload; explicitly open guidance to resume. Blocked or malformed browser storage does not prevent using the guide. Cross-device progress is deferred.

## Data and navigation

The existing shared draft guard protects opening guidance, moving to its editors, switching workspace views/projects, and signing out. Failed saves stop navigation and retain drafts. Private editors remain inside the member-only workspace. No schema, rule, service, production dependency, or authentication change was needed.

## Deployment and verification

Updating from the Google sign-in ZIP requires **Hosting only**:

```powershell
npm.cmd ci
npm.cmd run build
npx.cmd firebase deploy --only hosting
```

Automated coverage includes guide pause/resume and per-account/project storage, editor focus/navigation, review-disabled learning guidance, and a failed save while entering the dedicated guide followed by keep-editing/discard. Existing workspace regressions remain covered. Browser visual acceptance remains pending; nothing has been deployed by this delivery.

Manual acceptance: open guidance on desktop and mobile, move between each editor and its remembered guide step, pause/resume, use keyboard step selection, check that the chart and drawer do not appear in the guide, and confirm unsaved promises/insights are protected when entering it. Repeat with formal reviews disabled.

Next after acceptance: **3A — Immutable wording and promise history**.
