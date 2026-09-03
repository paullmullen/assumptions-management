import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase.js";
import {
  loadAssumptions,
  loadInsights,
  loadProjectBrief,
} from "../../services.js";
import { validateReview } from "./reviewValues.js";

export async function loadReviews(projectId) {
  const result = await getDocs(
    collection(db, "projects", projectId, "reviews"),
  );
  return result.docs
    .map((item) => ({ ...item.data(), id: item.id }))
    .sort(
      (a, b) =>
        b.publishedAt.toMillis() - a.publishedAt.toMillis() ||
        b.id.localeCompare(a.id),
    );
}

export async function captureReview(projectId) {
  const [assumptions, promises, reviews] = await Promise.all([
    loadAssumptions(projectId),
    loadProjectBrief(projectId),
    loadReviews(projectId),
  ]);
  const rows = await Promise.all(
    assumptions.map(async (item) => ({
      id: item.id,
      statement: item.statement,
      criticality: item.criticality ?? null,
      evidence: item.evidence ?? null,
      nextStep: item.nextStep ?? "",
      helpNeeded: item.helpNeeded ?? "",
      insights: (await loadInsights(projectId, item.id)).map((insight) => ({
        ...insight,
        createdAt: insight.createdAt?.toMillis() ?? null,
      })),
    })),
  );
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return {
    previous: reviews[0] ?? null,
    snapshot: {
      assumptions: rows,
      promises: Object.fromEntries(
        ["customerPromise", "investorPromise", "coworkerPromise"].map((key) => [
          key,
          promises[key] ?? "",
        ]),
      ),
      capturedAt: Date.now(),
    },
  };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

// Reusing the draft's ID makes retry safe if the original commit's response was lost.
export function newReviewId(projectId) {
  return doc(collection(db, "projects", projectId, "reviews")).id;
}

export async function publishReview(user, projectId, reviewId, values) {
  validateReview(values);
  const reference = doc(db, "projects", projectId, "reviews", reviewId);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reference);
    if (existing.exists()) {
      const saved = existing.data();
      const expected = {
        ...values,
        title: values.title.trim(),
        notes: values.notes.trim(),
      };
      const actual = Object.fromEntries(
        Object.keys(expected).map((key) => [key, saved[key]]),
      );
      if (
        saved.publishedBy !== user.uid ||
        JSON.stringify(canonical(actual)) !==
          JSON.stringify(canonical(expected))
      )
        throw new Error(
          "This review was already published with different content. Close this draft and reload the published reviews.",
        );
      return;
    }
    transaction.set(reference, {
      ...values,
      title: values.title.trim(),
      notes: values.notes.trim(),
      schemaVersion: 1,
      publishedBy: user.uid,
      publisherEmail: user.email,
      publishedAt: serverTimestamp(),
    });
  });
}
