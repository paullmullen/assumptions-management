// @vitest-environment node
import { expect, it } from "vitest";
import { createFirestoreEmailStore } from "./firestore-store.js";

// Serialized in-memory Admin transaction contract; live Admin/emulator
// integration remains pending approval of the production SDK dependencies.
function database() {
  const docs = new Map();
  const snapshot = (path) => ({
    exists: docs.has(path),
    data: () => {
      const value = docs.get(path);
      return (
        value && {
          ...value,
          ...(value.expiresAt instanceof Date
            ? { expiresAt: { toMillis: () => value.expiresAt.getTime() } }
            : {}),
        }
      );
    },
  });
  const ref = (path) => ({
    path,
    update: async (values) => docs.set(path, { ...docs.get(path), ...values }),
  });
  let pending = Promise.resolve();
  return {
    docs,
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    runTransaction: (callback) => {
      const next = pending.then(async () => {
        const writes = [];
        const result = await callback({
          get: async (reference) => snapshot(reference.path),
          set: (reference, values) =>
            writes.push(() => docs.set(reference.path, values)),
          create: (reference, values) =>
            writes.push(() => {
              if (docs.has(reference.path)) throw new Error("exists");
              docs.set(reference.path, values);
            }),
          update: (reference, values) =>
            writes.push(() =>
              docs.set(reference.path, {
                ...docs.get(reference.path),
                ...values,
              }),
            ),
        });
        writes.forEach((write) => write());
        return result;
      });
      pending = next.catch(() => {});
      return next;
    },
  };
}
const job = (id, now = 100000) => ({
  id,
  kind: "verify",
  uid: "u1",
  status: "pending",
  createdAt: now,
  expiresAt: now + 86400000,
});
it("atomically rejects concurrent resends and permits a later request", async () => {
  const db = database();
  const store = createFirestoreEmailStore(db);
  const quota = [{ id: "recipient", limit: 2, cooldownMs: 60000 }];
  expect(
    await Promise.all([
      store.enqueue(job("a"), quota, 100000),
      store.enqueue(job("b"), quota, 100000),
    ]),
  ).toEqual([true, false]);
  expect(db.docs.has("authEmailJobs/b")).toBe(false);
  expect(await store.enqueue(job("c"), quota, 160000)).toBe(true);
  expect(await store.enqueue(job("d"), quota, 220000)).toBe(false);
  expect(await store.enqueue(job("e", 3700000), quota, 3700000)).toBe(true);
});
it("does not consume one quota when another denies the request", async () => {
  const db = database();
  const store = createFirestoreEmailStore(db);
  expect(
    await store.enqueue(
      job("a"),
      [{ id: "global", limit: 1, cooldownMs: 0 }],
      100000,
    ),
  ).toBe(true);
  expect(
    await store.enqueue(
      job("b"),
      [
        { id: "recipient", limit: 5, cooldownMs: 60000 },
        { id: "global", limit: 1, cooldownMs: 0 },
      ],
      100000,
    ),
  ).toBe(false);
  expect(db.docs.has("authEmailLimits/recipient")).toBe(false);
});
it("claims a job only once and expires stale jobs without sending", async () => {
  const db = database();
  const store = createFirestoreEmailStore(db);
  await store.enqueue(job("a"), [], 100000);
  const claims = await Promise.all([
    store.claim("a", 100001),
    store.claim("a", 100001),
  ]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  await store.finish("a", "accepted-by-provider", 100002);
  expect(await store.claim("a", 100003)).toBeNull();
  await store.enqueue(job("b"), [], 100000);
  expect(await store.claim("b", 100000 + 86400001)).toBeNull();
  expect(db.docs.get("authEmailJobs/b").status).toBe("expired");
});
