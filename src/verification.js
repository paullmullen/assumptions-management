import { sendEmailVerification, sendPasswordResetEmail } from "firebase/auth";
import {
  auth,
  functions,
  customAuthEmailEnabled,
  authEmailConfigured,
} from "./firebase.js";
import { createAuthEmailClient } from "./authEmailClient.js";

function customClient() {
  if (!authEmailConfigured) {
    const error = new Error(
      "Authentication email configuration is incomplete.",
    );
    error.code = "auth/email-configuration";
    throw error;
  }
  return createAuthEmailClient(functions);
}

export function sendVerificationEmail(user) {
  return customAuthEmailEnabled
    ? customClient().sendVerificationEmail()
    : sendEmailVerification(user);
}

export function requestPasswordResetEmail(email) {
  return customAuthEmailEnabled
    ? customClient().sendPasswordResetEmail(email)
    : sendPasswordResetEmail(auth, email);
}

export async function refreshVerificationState(user) {
  await user.reload();
  if (!user.emailVerified) return false;
  await user.getIdToken(true);
  return true;
}
