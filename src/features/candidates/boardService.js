import {
  collection,
  doc,
  getDocsFromServer,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase.js";
import {
  candidateGroup,
  candidateRank,
  validateCombination,
} from "./boardValues.js";
export function newBoardId(projectId, kind = "candidates") {
  return doc(collection(db, "projects", projectId, kind)).id;
}
export async function loadCandidateGroups(projectId) {
  const snapshot = await getDocsFromServer(
    collection(db, "projects", projectId, "candidateGroups"),
  );
  return snapshot.docs
    .map((item) => ({ ...item.data(), id: item.id }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export async function saveCandidateGroup(user, projectId, id, name) {
  const text = name.trim();
  if (!text || text.length > 80)
    throw new Error("Enter a group name of 1–80 characters.");
  const ref = doc(db, "projects", projectId, "candidateGroups", id);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists()) {
      if (
        existing.data().name === text &&
        existing.data().createdBy === user.uid
      )
        return;
      throw new Error("This group already exists. Refresh the board.");
    }
    tx.set(ref, {
      name: text,
      createdBy: user.uid,
      authorEmail: user.email,
      createdAt: serverTimestamp(),
    });
  });
  return { id, name: text, createdBy: user.uid, authorEmail: user.email };
}
export async function moveCandidate(
  user,
  projectId,
  item,
  groupId,
  orderedRows,
) {
  if (orderedRows.length > 450)
    throw new Error(
      "This group is too large to reorder at once. Move cards into smaller groups.",
    );
  const ids = orderedRows.map((row) => row.id);
  if (new Set(ids).size !== ids.length || !ids.includes(item.id))
    throw new Error("Invalid card order.");
  const refs = orderedRows.map((row) =>
    doc(db, "projects", projectId, "candidates", row.id),
  );
  await runTransaction(db, async (tx) => {
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
    snapshots.forEach((snap, index) => {
      const current = snap.data(),
        expected = orderedRows[index];
      if (!snap.exists() || current.status !== "pending")
        throw new Error(
          "A candidate is no longer pending. Refresh candidates.",
        );
      const alreadyPlaced =
        candidateGroup(current) === groupId &&
        candidateRank(current) === (index + 1) * 1024;
      // Fresh captures have no local server timestamp yet; explicit ranks are always checked.
      const expectedRankKnown =
        expected.rank != null || Boolean(expected.createdAt?.toMillis);
      if (
        !alreadyPlaced &&
        (candidateGroup(current) !== candidateGroup(expected) ||
          (!expectedRankKnown && current.rank != null) ||
          (expectedRankKnown &&
            candidateRank(current) !== candidateRank(expected)))
      )
        throw new Error(
          "Someone moved a candidate. Refresh candidates before moving it again.",
        );
    });
    snapshots.forEach((snap, index) => {
      if (
        candidateGroup(snap.data()) !== groupId ||
        snap.data().rank !== (index + 1) * 1024
      )
        tx.update(snap.ref, {
          groupId,
          rank: (index + 1) * 1024,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
    });
  });
  return orderedRows.map((row, index) => ({
    ...row,
    groupId,
    rank: (index + 1) * 1024,
  }));
}
export async function combineCandidates(user, projectId, id, items, statement) {
  const text = validateCombination(items, statement);
  const target = doc(db, "projects", projectId, "candidates", id);
  const sourceIds = items.map((row) => row.id);
  if (sourceIds.includes(id))
    throw new Error("A candidate cannot include itself.");
  return runTransaction(db, async (tx) => {
    const existing = await tx.get(target);
    if (existing.exists()) {
      const saved = existing.data();
      if (
        saved.createdBy === user.uid &&
        saved.statement === text &&
        JSON.stringify(saved.sourceCandidateIds) === JSON.stringify(sourceIds)
      )
        return { ...saved, id };
      throw new Error(
        "This combination was already saved with different wording. Refresh candidates.",
      );
    }
    const sources = await Promise.all(
      items.map((row) =>
        tx.get(doc(db, "projects", projectId, "candidates", row.id)),
      ),
    );
    sources.forEach((snap, index) => {
      if (
        !snap.exists() ||
        snap.data().status !== "pending" ||
        snap.data().statement !== items[index].statement
      )
        throw new Error(
          "A selected candidate changed or is no longer pending. Your combined wording is retained. Cancel and refresh to review the latest candidates.",
        );
    });
    const first = sources[0].data();
    const record = {
      statement: text,
      status: "pending",
      sourceCandidateIds: sourceIds,
      groupId: candidateGroup(first),
      rank: candidateRank(first),
      createdBy: user.uid,
      authorEmail: user.email,
      createdAt: serverTimestamp(),
    };
    tx.set(target, record);
    sources.forEach((snap) =>
      tx.update(snap.ref, {
        status: "combined",
        combinedInto: id,
        combinedBy: user.uid,
        combinedAt: serverTimestamp(),
      }),
    );
    return { ...record, id, createdAt: null };
  });
}
