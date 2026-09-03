# Optional guided start

Open **Guided start** beneath the project title. Direct editing remains available whether guidance is open or paused.

The five steps explain the Three Promises, affirmative assumptions, a static blind-spot check, the two scoring axes and prioritization, and learning/formal reviews. Each step links to the relevant existing section and moves keyboard focus there. Previous/Next changes guidance only: it neither saves forms nor declares project work complete.

Progress is an optional browser preference keyed by account and project. Pause, reopen, or return later on the same browser to resume. Guidance can be revisited after finishing. Clearing browser storage resets it; another device starts fresh. Only the open state and step number are stored, not project content. If browser storage is blocked or malformed, the guide remains usable without persistence. Existing membership checks still control access to the project screen; no Firestore data, rules, backend, or production dependencies changed.

## Manual acceptance

1. Open an existing project. Confirm the guide starts collapsed and all editors remain available.
2. Open guidance, use Next, and use the editor link. Confirm it brings the relevant section into view and keyboard focus moves there.
3. Save a promise or assumption in its normal editor. Confirm Next does not claim to save that work.
4. Pause, reopen, and reload: the same step should return on this browser.
5. Switch projects or accounts: each has separate progress.
6. Reach the final step, finish, and reopen. Use Previous to revisit earlier guidance.
7. At a narrow/mobile width, check that buttons wrap and text remains readable. With a keyboard, check all guidance actions and editor links.

Automated component checks cover direct entry, pause/resume, reload, account/project separation, editor focus, finish/reopen, invalid preferences, and blocked storage writes. Unfamiliar-user and live browser acceptance remain manual gates.

Deploy with the existing `npm.cmd run deploy:development` command after extracting the updated project. Keep local Firebase configuration in place.
