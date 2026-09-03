# Set up authentication email delivery

> Deferred: Google sign-in is now the tester onboarding path. Keep native Firebase email delivery active. See [Google setup](Google-Sign-In.md). Project contact: mullenpaull@gmail.com.

The code is implemented; SMTP2GO delivery is not yet activated for the running app. This guide covers the remaining configuration and deployment. Use the included Node 22 backend. The approved SDK versions are pinned in `email-service/package-lock.json`.

## 1. Install and choose the sender

From the extracted project directory:

```powershell
npm.cmd ci
npm.cmd --prefix email-service ci
```

Choose the email address that should appear as **Assumptions Management <address>**. Verify its sender/domain with SMTP2GO, including the DNS authentication they provide. Create a separate SMTP2GO API key for this project with email-sending access.

Firebase Functions deployment requires a billing-enabled Blaze project. Check the configured project is `assumptions-management` before deploying. See [Firebase setup requirements](https://firebase.google.com/docs/functions/get-started).

Copy `email-service/.env.example` to `email-service/.env.assumptions-management`, then replace the sender:

```dotenv
AUTH_EMAIL_FROM=your-verified-sender@your-domain
AUTH_EMAIL_APP_URL=https://assumptions-management.web.app
AUTH_EMAIL_ACTION_ORIGIN=https://assumptions-management.firebaseapp.com
```

Use the origins for the actual target project if deploying elsewhere. The action origin should be the domain used by Firebase's email action handler. The app URL must be on Firebase Authentication's authorized domains.

## 2. Store the secrets

These commands prompt for the values. Do not put them in the browser's .env file, source control, or chat.

```powershell
npx.cmd firebase functions:secrets:set SMTP2GO_API_KEY --project assumptions-management
npx.cmd firebase functions:secrets:set AUTH_EMAIL_RATE_SECRET --project assumptions-management
```

The first value is the SMTP2GO API key. The second is an independently generated random secret of at least 32 characters (for example, from a password manager). It hashes quota identities. Keep it stable between deployments so existing quotas remain effective.

## 3. Register App Check and retention

Register this web app for Firebase App Check using **reCAPTCHA Enterprise**. Add the actual app hostname to the key's allowed domains. Copy its public site key into the frontend configuration in step 5. The production callable requires a valid App Check token; this is independent of the user's Firebase sign-in token. See [Firebase's web setup](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).

In Firestore's TTL settings, enable the `expiresAt` field for these collection groups:

- `authEmailJobs`
- `authEmailLimits`

The code sets expiry to one day. TTL deletion is asynchronous; the worker separately refuses expired jobs. These documents are private server records, and current security rules deny browser access. See [Firestore TTL setup](https://firebase.google.com/docs/firestore/ttl).

## 4. Test and deploy the backend first

```powershell
npm.cmd run check
npm.cmd run test:rules
npm.cmd run test:email-core
npm.cmd run test:email
npm.cmd run deploy:email
```

The two email tests use demo projects and cannot contact SMTP2GO. `test:email-core` exercises real Admin/Auth/Firestore integration directly. `test:email` adds the Functions HTTP endpoint and Firestore-triggered worker.

The full Functions-emulator test was blocked in the build workspace by an operating-system restriction on local sockets. Its test file is included for execution on your machine; it has not been reported as passing. Run it before rollout, or perform an equivalent controlled deployed-function smoke test.

`deploy:email` deploys only the `auth-email` codebase. Its function names are `requestAuthEmail` and `deliverAuthEmail`, both in `us-central1`. It does not activate the frontend setting.

If using interactive `npm run emulators` instead of the tests, create local `email-service/.env.local` and `email-service/.secret.local` files with dummy values. The test runner creates and removes dummy fixtures only when these files do not already exist. Local email delivery always captures to `authEmailTestOutbox`; it never calls SMTP2GO. App Check has no emulator, so only that local callable omits App Check enforcement; Auth validation still runs. The production function always requires App Check.

## 5. Enable custom delivery and deploy Hosting

After the backend is ready, add these to your existing frontend `.env.local`:

```dotenv
VITE_AUTH_EMAIL_DELIVERY=custom
VITE_FIREBASE_APP_CHECK_SITE_KEY=your-public-recaptcha-enterprise-site-key
VITE_USE_FIREBASE_EMULATORS=false
```

Keep your existing Firebase web-app settings. The reCAPTCHA **site key** is public; it is not an SMTP2GO secret.

```powershell
npm.cmd run deploy:development
```

This builds and deploys Hosting and Firestore rules. Refresh the app afterwards. The switch is build-time configuration: changing the file without rebuilding does not alter the running app.

The default remains `VITE_AUTH_EMAIL_DELIVERY=firebase` until you explicitly select `custom`. This avoids breaking signup during setup. Once custom is selected, failed calls do not fall back to native email and potentially send duplicates.

## 6. Validate with controlled test accounts

Before inviting testers, check:

1. Sign up: receive the branded message, use its button, return and sign in with project access enabled only after verification.
2. Resend: an unverified account can request another email; rapid repeats produce a clear wait message.
3. Initial delivery failure: the account still exists and can sign in/resend. A successful request says “requested,” not that inbox delivery is guaranteed.
4. Password reset: known and unknown addresses get the same public acknowledgement; only an eligible account receives a reset email.
5. Use a reset link, sign in with the new password, then verify the used link cannot be reused.
6. Check Gmail, Outlook, phone rendering, junk folders, and the plain-text alternative. The templates keep a copyable link below the button.
7. An App Check failure or missing configuration gives an error instead of claiming an email was sent.

For expired links, request another email from the app. No expiration time is hardcoded in our copy.

## Troubleshooting and rollback

- **Email delivery is not ready:** confirm both functions are deployed, the App Check key is correct, the hostname is allowed, and the custom frontend was rebuilt.
- **Request accepted but no email:** inspect the job's status and SMTP2GO activity. `accepted-by-provider` means SMTP2GO accepted it; it does not prove inbox delivery.
- **failed / processing job:** a timeout can occur after provider acceptance. The worker does not automatically resend an ambiguous job. Request a fresh email after the cooldown; investigate repeated failures in Functions logs.
- **pending job:** check `deliverAuthEmail` is deployed, its Firestore trigger is attached, and the runtime service account can access the default database.
- **Rate limit:** defaults are one request per identity per minute, five per hour, thirty per IP per hour, and five hundred total per hour. Existing queue jobs continue processing.
- **Emergency delivery rollback:** set `VITE_AUTH_EMAIL_DELIVERY=firebase`, rebuild/deploy Hosting, and refresh. This restores Firebase-native delivery for new requests; already queued custom jobs can still complete. It does not remove accounts or project data.

Do not expose job documents, raw action links, or provider credentials in public troubleshooting logs.
