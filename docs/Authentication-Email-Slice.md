# Authentication email slice — implemented, activation pending

> Deferred: Google sign-in is now the tester onboarding path. Keep native Firebase email delivery active. See [Google setup](Google-Sign-In.md). Project contact: mullenpaull@gmail.com.

The user approved `firebase-admin`, `firebase-functions`, and SMTP2GO. The backend now uses Admin SDK 14.3.0 and Functions SDK 7.3.2, pinned in its separate Node 22 package and lockfile.

This slice comes before 2C to unblock tester onboarding. Verification/resend and password reset are implemented. Project invitation email remains deferred. No live deployment or email delivery has been performed.

## Delivered behavior

The client routes email requests through `requestAuthEmail` when `VITE_AUTH_EMAIL_DELIVERY=custom`. Without that setting, it retains Firebase-native delivery during rollout. Custom mode initializes App Check from the public reCAPTCHA Enterprise site key and reports missing configuration. It does not silently fall back after a failed or uncertain custom request.

Signup stores the basic profile before requesting email. If email submission fails, the new account remains available for sign-in/resend. Copy says the email was requested rather than claiming confirmed delivery.

The callable validates App Check and uses the authenticated UID for verification. It never accepts an arbitrary verification recipient. Reset accepts only an email address, without account lookup on the public request path.

Requests enter a private transactional Firestore queue with shared cooldown/hourly quotas. Identity keys are HMAC hashes. The Firestore-created worker looks up the current account and generates Firebase action links in memory. Unknown/disabled accounts and already-verified verification requests are skipped as appropriate. Browser clients cannot access jobs or quotas.

SMTP2GO receives HTML and plain-text messages, with a prominent button and copyable fallback. Provider rejection is detected even when the HTTP response itself succeeds. Links, keys, and raw provider errors are not logged. Jobs retain a sanitized terminal status.

Each job is claimed once. Repeated trigger execution cannot automatically resend it. If the worker crashes or loses provider acknowledgement, the user can request a fresh email after the cooldown; there is no claim of guaranteed inbox delivery or exactly-once delivery.

## Configuration and acceptance

Follow [Authentication email setup](Authentication-Email-Setup.md). Remaining inputs are the verified sender address, SMTP2GO API secret, quota HMAC secret, App Check site key/domain registration, and Firestore TTL configuration. The test runner's dummy emulator secrets are not deployment credentials.

Backend and frontend are separate rollout steps. Nothing has been deployed. Custom delivery remains off until configured and enabled. Real SMTP delivery, App Check attestation in the deployed browser, inbox placement, and email-client rendering remain acceptance gates before onboarding testers.

## Verification

- Application/service unit tests, formatting, lint, and production builds pass.
- Real Admin/Auth/Firestore integration passed on Node 22: verification and reset links were generated and consumed; reused links were rejected; concurrent queue transactions enforced cooldown; duplicate worker processing did not send twice.
- The full Functions-emulator HTTP/trigger suite could not run successfully in this workspace because its runtime socket was blocked with EPERM. It is included as `npm run test:email` and must pass on a supported machine, or be replaced by equivalent controlled deployed-function acceptance.
- The emulator uses a demo project and captures messages locally. It never calls SMTP2GO.
- Production App Check enforcement is covered by adapter-option tests; real browser attestation remains a deployment check.
- HTML/text previews remain in `docs/email-previews`, using nonfunctional example links.

## Primary references

- [Firebase: generating email action links](https://firebase.google.com/docs/auth/admin/email-action-links)
- [Firebase: callable functions](https://firebase.google.com/docs/functions/callable)
- [Firebase: App Check enforcement](https://firebase.google.com/docs/app-check/cloud-functions)
- [Firebase: environment parameters and secrets](https://firebase.google.com/docs/functions/config-env)
- [SMTP2GO: send an email](https://developers.smtp2go.com/docs/send-an-email)
