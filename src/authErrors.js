const messages = {
  "auth/popup-closed-by-user":
    "Google sign-in was cancelled. Try again when ready.",
  "auth/cancelled-popup-request":
    "A Google sign-in window is already open. Complete it or try again.",
  "auth/popup-blocked":
    "Allow pop-ups for this site, then try Continue with Google again.",
  "auth/operation-not-allowed":
    "Google sign-in is not enabled yet. Use email and password or contact Paul.",
  "auth/unauthorized-domain":
    "Google sign-in is not configured for this website. Contact Paul.",
  "auth/account-exists-with-different-credential":
    "Sign in using your existing method, then choose Connect Google account to keep your projects.",
  "auth/credential-already-in-use":
    "That Google account is already connected to another account. Your current account and projects have not been changed. Contact Paul for help.",
  "auth/provider-already-linked":
    "This account already has Google connected. Sign out and continue with Google.",
  "auth/requires-recent-login":
    "Sign out and sign in again, then connect your Google account.",
  "auth/network-request-failed":
    "Check your internet connection and try again.",
  "functions/resource-exhausted":
    "Please wait at least a minute before requesting another email. If you have tried several times, try again later.",
  "functions/unavailable":
    "Email requests are temporarily unavailable. Please try again. If you just signed up, your account still exists.",
  "functions/not-found":
    "Email delivery is not ready yet. Please contact the project owner.",
  "functions/failed-precondition":
    "Reload the app and try again. If email still cannot be requested, contact the project owner.",
  "functions/unauthenticated":
    "Sign in again before requesting a verification email.",
  "functions/invalid-argument": "Enter a valid email address.",
  "auth/email-configuration":
    "Email delivery is not ready yet. Please contact the project owner.",
  "auth/too-many-requests":
    "Too many requests. Please wait before trying again.",
  "auth/email-already-in-use":
    "An account already exists for this email. Sign in or reset your password.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/user-not-found": "Email or password is incorrect.",
  "auth/weak-password": "Use a password with at least 8 characters.",
  "auth/wrong-password": "Email or password is incorrect.",
};

export function authenticationErrorMessage(error) {
  return (
    messages[error?.code] ??
    "We could not complete that request. Check the details and try again."
  );
}
