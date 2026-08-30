import { sendEmailVerification } from "firebase/auth";

export function sendVerificationEmail(user) {
  return sendEmailVerification(user);
}

export async function refreshVerificationState(user) {
  await user.reload();
  if (!user.emailVerified) return false;
  await user.getIdToken(true);
  return true;
}
