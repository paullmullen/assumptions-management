import { comparisonBaseline, compareReport } from "./reportComparison.js";
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
} from "firebase/firestore";
import { db } from "../../firebase.js";

export async function verifyReportAccess(projectId) {
  const project = await getDocFromServer(doc(db, "projects", projectId));
  if (!project.exists()) throw new Error("Project unavailable.");
  return project.data();
}
export async function loadReportReviews(projectId) {
  const snapshot = await getDocsFromServer(
    collection(db, "projects", projectId, "reviews"),
  );
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => b.publishedAt.toMillis() - a.publishedAt.toMillis());
}
export async function loadReportSource(projectId, source = "current") {
  const project = await verifyReportAccess(projectId);
  if (source !== "current") {
    const snapshot = await getDocFromServer(
      doc(db, "projects", projectId, "reviews", source),
    );
    if (!snapshot.exists()) throw new Error("Review unavailable.");
    const review = snapshot.data();
    return {
      projectName: project.name,
      kind: "review",
      title: review.title,
      capturedAt: review.capturedAt,
      publishedAt: review.publishedAt.toMillis(),
      loadedAt: Date.now(),
      promises: review.promises,
      assumptions: review.assumptions,
    };
  }
  const [assumptions, promises] = await Promise.all([
    getDocsFromServer(collection(db, "projects", projectId, "assumptions")),
    getDocFromServer(
      doc(db, "projects", projectId, "projectBrief", "overview"),
    ),
  ]);
  // Verify membership again after loading; never return a partial report.
  await verifyReportAccess(projectId);
  return {
    projectName: project.name,
    kind: "current",
    loadedAt: Date.now(),
    promises: promises.exists() ? promises.data() : {},
    assumptions: assumptions.docs.map((item) => ({
      ...item.data(),
      id: item.id,
    })),
  };
}

// Only authorized project paths are read; a failed history load must not appear as zero changes.
export async function loadReportComparison(projectId, source, reviews) {
  const baseline = comparisonBaseline(source, reviews);
  if (!baseline) return null;
  const assumptions =
    source.kind === "current"
      ? await Promise.all(
          source.assumptions.map(async (row) => {
            const history = await getDocsFromServer(
              collection(
                db,
                "projects",
                projectId,
                "assumptions",
                row.id,
                "insights",
              ),
            );
            return {
              ...row,
              insights: history.docs.map((item) => ({
                ...item.data(),
                id: item.id,
              })),
            };
          }),
        )
      : source.assumptions;
  await verifyReportAccess(projectId);
  return compareReport({ ...source, assumptions }, baseline);
}
