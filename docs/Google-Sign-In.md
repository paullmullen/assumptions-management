# Google sign-in — tester onboarding

Project contact: **Paul Mullen — mullenpaull@gmail.com**.

Google is now the primary sign-in option. Email/password remains available. Custom SMTP2GO delivery is parked; no domain registration, sender setup, or email Functions deployment is needed for this slice. No new dependency or Firestore rule change was introduced.

## Enable and deploy

1. Open [Firebase Authentication providers](https://console.firebase.google.com/project/assumptions-management/authentication/providers).
2. Enable **Google**. Set the public-facing project name to **Assumptions Management** and the support email to **mullenpaull@gmail.com**, then save. If that address is unavailable in the selector, sign in to Firebase with that Google account after giving it appropriate project access, or configure the support contact in the Google Auth Platform branding settings. This ZIP does not change console settings or IAM.
3. Keep **Email/Password** enabled for existing accounts. Keep Firebase's one-account-per-email setting; do not enable multiple accounts per email.
4. Under Authentication → Settings → Authorized domains, confirm `assumptions-management.web.app` and `assumptions-management.firebaseapp.com` are listed. Add `localhost` explicitly if you use real Google sign-in in local development. Only add domains you actually use.
5. In your local frontend environment set `VITE_AUTH_EMAIL_DELIVERY=firebase`. Leave the App Check key unset unless you use App Check for another purpose. The Google flow does not call our email service.
6. From the project directory, install and deploy Hosting:

   ```powershell
   npm.cmd ci
   npm.cmd run build
   npx.cmd firebase deploy --only hosting
   ```

Existing Firebase configuration values are still required. Do not deploy the email Functions for this slice. If the Google OAuth consent configuration is in Testing status, ensure the intended testers are permitted in its audience settings.

## Preserve your existing projects when connecting Gmail

For Paul: **first sign in using the existing account that owns your projects** (for example, the Outlook email and its password). Then choose **Connect Google account** in the header and select **mullenpaull@gmail.com** in Google's chooser. Connecting uses Firebase account linking and retains the existing UID, which is the project-membership key. The app reloads after success to refresh the account and token.

Do not start with Continue with Google under a different email: that can create a separate account with no existing memberships. If that already happened, sign back into the original account. A Google credential already attached to another account cannot be linked here; the app reports the conflict without switching accounts. Account merging/deletion is deliberately not automatic.

Connecting authenticates control of both accounts. It is not a general-purpose account email-change feature; the contact address above does not rewrite existing Auth primary emails, memberships, or historical author records. New invitation links must match the accepting account's current Firebase primary email.

Users who already signed up with the same Google email can use Firebase's normal same-email provider behavior. If Firebase requires the existing sign-in method, use that method first and connect Google from the header. Unverified email/password accounts also have a Connect Google account action on the verification screen; connecting a different email does not necessarily verify the original primary email, so its existing verification step may still be required. The app still requires a verified Firebase email claim before exposing any project content.

## Acceptance checks

- New tester: Continue with Google → choose account → project selection/create page without our verification email, provided Firebase marks the email verified.
- Existing owner: record the original UID in Authentication → Users; connect Google from the existing account; confirm UID and projects remain; sign out and sign back in with Google.
- Close or block the popup: readable error, email/password remains available, no unexpected navigation.
- Attempt an already-used Google credential: original account remains signed in and retains its projects.
- With unsaved project edits, Connect Google account offers the existing save/discard/keep-editing guard before opening Google.
- Invitation deep link remains in the URL during popup sign-in and is available after authentication; verify membership boundaries with a second account.
- Check the popup on desktop and mobile browsers. If blocked, allow popups for this site and retry. This slice uses popup authentication, not redirect authentication.

Automated checks: `npm run check`; `npm run test:google` tests linking different emails, retaining UID and verified sign-in, and rejecting credentials already used by another account against the Auth emulator. The emulator uses synthetic Google tokens and does not replace real OAuth/browser acceptance. Live Google consent, production provider setup, and browser acceptance remain pending.

References: [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [account linking](https://firebase.google.com/docs/auth/web/account-linking).
