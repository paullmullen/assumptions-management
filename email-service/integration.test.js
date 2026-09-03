// @vitest-environment node
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = "demo-auth-email";
const authHost = "http://127.0.0.1:9099";
const firestoreHost = "http://127.0.0.1:8082";
const endpoint =
  "http://127.0.0.1:5002/demo-auth-email/us-central1/requestAuthEmail";
let app, auth, db;
async function authRequest(operation, data) {
  const response = await fetch(
    `${authHost}/identitytoolkit.googleapis.com/v1/accounts:${operation}?key=fake-key`,
    {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  return { status: response.status, data: await response.json() };
}
async function call(data, token) {
  const response = await fetch(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  return { status: response.status, body: await response.json() };
}
async function waitForJob() {
  for (let attempt = 0; attempt < 150; attempt++) {
    const jobs = await db.collection("authEmailJobs").get();
    const job = jobs.docs[0]?.data();
    if (job && !["pending", "processing"].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Email worker did not finish in the emulator.");
}
beforeAll(() => {
  if (
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8082" ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099"
  )
    throw new Error("Run this test only through npm run test:email.");
  app = initializeApp({ projectId }, "email-integration");
  auth = getAuth(app);
  db = getFirestore(app);
});
beforeEach(async () => {
  await fetch(
    `${firestoreHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  await fetch(`${authHost}/emulator/v1/projects/${projectId}/accounts`, {
    method: "DELETE",
  });
});
afterAll(async () => {
  await db?.terminate();
  if (app) await deleteApp(app);
});

it("rejects unauthenticated verification and accepts unknown resets without sending mail", async () => {
  expect((await call({ kind: "verify" })).status).toBe(401);
  const response = await call({ kind: "reset", email: "missing@example.com" });
  expect(response).toEqual({
    status: 200,
    body: { result: { accepted: true } },
  });
  expect((await waitForJob()).status).toBe("skipped");
  expect((await db.collection("authEmailTestOutbox").get()).empty).toBe(true);
  expect(
    (await call({ kind: "reset", email: "missing@example.com" })).status,
  ).toBe(429);
});
it("creates a real verification link, enforces recipient ownership, and verifies the account", async () => {
  const signedUp = await authRequest("signUp", {
    email: "verify@example.com",
    password: "test-password-123",
    returnSecureToken: true,
  });
  expect(signedUp.status).toBe(200);
  const token = signedUp.data.idToken;
  expect(
    (await call({ kind: "verify", email: "other@example.com" }, token)).status,
  ).toBe(401);
  expect((await call({ kind: "verify" }, token)).status).toBe(200);
  expect((await waitForJob()).status).toBe("accepted-by-provider");
  const outbox = await db.collection("authEmailTestOutbox").get();
  expect(outbox.size).toBe(1);
  const mail = outbox.docs[0].data();
  expect(mail.to).toBe("verify@example.com");
  expect(mail.html).toContain("Verify my email");
  const actionLink = mail.text.match(/http:\/\/[^\s]+/)[0];
  const code = new URL(actionLink).searchParams.get("oobCode");
  expect(code).toBeTruthy();
  expect((await authRequest("update", { oobCode: code })).status).toBe(200);
  expect((await auth.getUser(signedUp.data.localId)).emailVerified).toBe(true);
  expect((await authRequest("update", { oobCode: code })).status).toBe(400);
  const jobs = await db.collection("authEmailJobs").get();
  expect(JSON.stringify(jobs.docs.map((d) => d.data()))).not.toContain(code);
});
it("generates and consumes a password reset link without changing the public response", async () => {
  await auth.createUser({
    email: "reset@example.com",
    password: "old-password-123",
  });
  expect(await call({ kind: "reset", email: "reset@example.com" })).toEqual({
    status: 200,
    body: { result: { accepted: true } },
  });
  expect((await waitForJob()).status).toBe("accepted-by-provider");
  const outbox = await db.collection("authEmailTestOutbox").get();
  const code = new URL(
    outbox.docs[0].data().text.match(/http:\/\/[^\s]+/)[0],
  ).searchParams.get("oobCode");
  expect(
    (
      await authRequest("resetPassword", {
        oobCode: code,
        newPassword: "new-password-456",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await authRequest("signInWithPassword", {
        email: "reset@example.com",
        password: "new-password-456",
        returnSecureToken: true,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await authRequest("resetPassword", {
        oobCode: code,
        newPassword: "reuse-password",
      })
    ).status,
  ).toBe(400);
});
