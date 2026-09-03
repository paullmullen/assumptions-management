// Uses the approved Admin Firestore SDK through an injected instance.
// Collections are server-only under the existing default-deny Firestore rules.
export function createFirestoreEmailStore(db) {
  const jobRef = (id) => db.collection("authEmailJobs").doc(id);
  return {
    enqueue(job, quotas, now) {
      return db.runTransaction(async (tx) => {
        const refs = quotas.map((q) =>
          db.collection("authEmailLimits").doc(q.id),
        );
        const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
        const windows = snapshots.map((snap) => {
          const prior = snap.exists ? snap.data() : null;
          return prior && now - prior.windowStart < 3600000
            ? prior
            : { count: 0, windowStart: now, lastAt: 0 };
        });
        if (
          windows.some(
            (window, i) =>
              window.count >= quotas[i].limit ||
              (window.count > 0 && now - window.lastAt < quotas[i].cooldownMs),
          )
        )
          return false;
        refs.forEach((ref, i) =>
          tx.set(ref, {
            count: windows[i].count + 1,
            windowStart: windows[i].windowStart,
            lastAt: now,
            expiresAt: new Date(now + 86400000),
          }),
        );
        const { id, ...data } = job;
        tx.create(jobRef(id), { ...data, expiresAt: new Date(job.expiresAt) });
        return true;
      });
    },
    claim(id, now) {
      return db.runTransaction(async (tx) => {
        const ref = jobRef(id);
        const snap = await tx.get(ref);
        if (!snap.exists || snap.data().status !== "pending") return null;
        const job = snap.data();
        if (job.expiresAt.toMillis() <= now) {
          tx.update(ref, { status: "expired" });
          return null;
        }
        tx.update(ref, { status: "processing", startedAt: now });
        return { ...job, id };
      });
    },
    async finish(id, status, now) {
      await jobRef(id).update({ status, finishedAt: now });
    },
  };
}
