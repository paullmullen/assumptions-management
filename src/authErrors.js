const messages = {
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
