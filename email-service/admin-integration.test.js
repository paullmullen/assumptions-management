// @vitest-environment node
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { createAuthEmailService } from "./service.js";
import { createFirestoreEmailStore } from "./firestore-store.js";
const projectId = "demo-auth-email-core";
const authHost = "http://127.0.0.1:9098";
let app, auth, db, service, outbox, time;
const context = { app: { appId: "emulator-core-test" }, ip: "192.0.2.1" };
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
beforeAll(() => {
  if (
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8083" ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9098"
  )
    throw new Error("Run only through npm run test:email-core.");
  app = initializeApp({ projectId }, "email-core-integration");
  auth = getAuth(app);
  db = getFirestore(app);
});
beforeEach(async () => {
  await fetch(
    `http://127.0.0.1:8083/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  await fetch(`${authHost}/emulator/v1/projects/${projectId}/accounts`, {
    method: "DELETE",
  });
  time = Date.now();
  outbox = [];
  service = createAuthEmailService({
    auth,
    store: createFirestoreEmailStore(db),
    send: async (mail) => outbox.push(mail),
    appUrl: "https://demo-auth-email-core.web.app",
    actionOrigin: authHost,
    allowEmulatorLinks: true,
    rateSecret: "integration-test-secret-not-production-123",
    now: () => time,
  });
});
afterAll(async () => {
  await db?.terminate();
  if (app) await deleteApp(app);
});
const jobId = async () =>
  (await db.collection("authEmailJobs").get()).docs[0].id;

it("generates a consumable verification link and claims the queue job once", async () => {
  const signup = await authRequest("signUp", {
    email: "verify@example.com",
    password: "password-123",
    returnSecureToken: true,
  });
  expect(signup.status).toBe(200);
  const decoded = await auth.verifyIdToken(signup.data.idToken);
  const caller = { uid: decoded.uid };
  await expect(
    service.request({
      ...context,
      auth: caller,
      data: { kind: "verify", email: "other@example.com" },
    }),
  ).rejects.toMatchObject({ code: "unauthenticated" });
  await service.request({ ...context, auth: caller, data: { kind: "verify" } });
  const id = await jobId();
  await Promise.all([service.process(id), service.process(id)]);
  expect(outbox).toHaveLength(1);
  expect(outbox[0].to).toBe("verify@example.com");
  const code = new URL(
    outbox[0].text.match(/http:\/\/[^\s]+/)[0],
  ).searchParams.get("oobCode");
  expect((await authRequest("update", { oobCode: code })).status).toBe(200);
  expect((await auth.getUser(decoded.uid)).emailVerified).toBe(true);
  expect((await authRequest("update", { oobCode: code })).status).toBe(400);
  const job = (await db.collection("authEmailJobs").doc(id).get()).data();
  expect(job.status).toBe("accepted-by-provider");
  expect(JSON.stringify(job)).not.toContain(code);
});
it("generates a consumable reset link and leaves an unknown-address request indistinguishable", async () => {
  await auth.createUser({
    email: "reset@example.com",
    password: "old-password-123",
  });
  const accepted = await service.request({
    ...context,
    data: { kind: "reset", email: "reset@example.com" },
  });
  await service.process(await jobId());
  const code = new URL(
    outbox[0].text.match(/http:\/\/[^\s]+/)[0],
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
  expect(
    await service.request({
      ...context,
      data: { kind: "reset", email: "unknown@example.com" },
    }),
  ).toEqual(accepted);
  const pending = (await db.collection("authEmailJobs").get()).docs.find(
    (d) => d.data().status === "pending",
  );
  await service.process(pending.id);
  expect((await pending.ref.get()).data().status).toBe("skipped");
  expect(outbox).toHaveLength(1);
});
it("enforces concurrent cooldown transactions and permits a later resend", async () => {
  const request = {
    ...context,
    data: { kind: "reset", email: "unknown@example.com" },
  };
  const results = await Promise.allSettled([
    service.request(request),
    service.request(request),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected").reason.code).toBe(
    "resource-exhausted",
  );
  expect((await db.collection("authEmailJobs").get()).size).toBe(1);
  time += 60001;
  await service.request(request);
  expect((await db.collection("authEmailJobs").get()).size).toBe(2);
});
it("keeps failed delivery terminal instead of duplicating an ambiguous send", async () => {
  const user = await auth.createUser({ email: "failed@example.com" });
  let sends = 0;
  const failing = createAuthEmailService({
    auth,
    store: createFirestoreEmailStore(db),
    send: async () => {
      sends++;
      throw new Error("unconfirmed");
    },
    appUrl: "https://demo-auth-email-core.web.app",
    actionOrigin: authHost,
    allowEmulatorLinks: true,
    rateSecret: "integration-test-secret-not-production-123",
  });
  await failing.request({
    ...context,
    auth: { uid: user.uid },
    data: { kind: "verify" },
  });
  const id = await jobId();
  await failing.process(id);
  await failing.process(id);
  expect(sends).toBe(1);
  expect(
    (await db.collection("authEmailJobs").doc(id).get()).data().status,
  ).toBe("failed");
});
