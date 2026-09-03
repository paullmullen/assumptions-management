// @vitest-environment node
import { afterAll, expect, it } from "vitest";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithCredential,
  signOut,
  sendEmailVerification,
  applyActionCode,
} from "firebase/auth";
const app = initializeApp(
  { apiKey: "demo-key", projectId: "demo-google-auth" },
  "google-test",
);
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
  disableWarnings: true,
});
afterAll(() => deleteApp(app));
function credential(email, sub) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({ iss: "https://accounts.google.com", aud: "demo-google-auth", sub, email, email_verified: true, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
  return GoogleAuthProvider.credential(token);
}
it("links a different Google email without changing the existing account UID", async () => {
  const original = await createUserWithEmailAndPassword(
    auth,
    "original@example.org",
    "Testing123!",
  );
  await sendEmailVerification(original.user);
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/demo-google-auth/oobCodes`,
  );
  const { oobCodes } = await response.json();
  const code = oobCodes.find(
    (item) =>
      item.email === "original@example.org" &&
      item.requestType === "VERIFY_EMAIL",
  );
  await applyActionCode(auth, code.oobCode);
  await original.user.reload();
  const uid = original.user.uid;
  const google = credential("pilot@gmail.com", "pilot-google");
  const linked = await linkWithCredential(original.user, google);
  expect(linked.user.uid).toBe(uid);
  expect(linked.user.providerData.map((p) => p.providerId)).toEqual(
    expect.arrayContaining(["password", "google.com"]),
  );
  await signOut(auth);
  const signedIn = await signInWithCredential(auth, google);
  expect(signedIn.user.uid).toBe(uid);
  expect(signedIn.user.emailVerified).toBe(true);
});
it("rejects linking Google credentials already held by a different account", async () => {
  const google = credential("pilot@gmail.com", "pilot-google");
  await signOut(auth);
  const other = await createUserWithEmailAndPassword(
    auth,
    "other@example.org",
    "Testing123!",
  );
  await expect(linkWithCredential(other.user, google)).rejects.toMatchObject({
    code: "auth/credential-already-in-use",
  });
  expect(auth.currentUser.uid).toBe(other.user.uid);
});

it("accepts a new verified Google identity without an app verification email", async () => {
  await signOut(auth);
  const result = await signInWithCredential(
    auth,
    credential("newtester@gmail.com", "new-google"),
  );
  expect(result.user.emailVerified).toBe(true);
});
