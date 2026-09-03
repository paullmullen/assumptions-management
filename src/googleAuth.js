import {
  GoogleAuthProvider,
  linkWithPopup,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "./firebase.js";

function provider() {
  const google = new GoogleAuthProvider();
  google.setCustomParameters({ prompt: "select_account" });
  return google;
}

export function continueWithGoogle() {
  return signInWithPopup(auth, provider());
}

// Linking authenticates Google while retaining the current Firebase UID.
// Never fall back to sign-in here: that could switch to a different account.
export async function connectGoogleAccount(user) {
  const result = await linkWithPopup(user, provider());
  await result.user.reload();
  await result.user.getIdToken(true);
  return result.user;
}

export function hasGoogleAccount(user) {
  return user?.providerData?.some((item) => item.providerId === "google.com");
}
