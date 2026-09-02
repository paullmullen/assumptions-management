import { normalizeInsight } from "./features/assumptions/insightValues.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase.js";

export async function updateAssumptionScores(
  user,
  projectId,
  assumptionId,
  scores,
  insightDescription = "",
) {
  return saveAssumptionChanges(
    user,
    projectId,
    assumptionId,
    scores,
    insightDescription.trim() ? { description: insightDescription } : null,
  );
}

export async function saveAssumptionChanges(
  user,
  projectId,
  assumptionId,
  scores,
  insightValues,
  managementValues = null,
) {
  if (
    scores &&
    ![scores.criticality, scores.evidence].every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 100,
    )
  )
    throw new RangeError("Assumption scores must be integers from 0 to 100.");
  const management =
    managementValues === null
      ? null
      : Object.fromEntries(
          Object.entries(managementValues).map(([key, value]) => {
            if (
              !["nextStep", "helpNeeded"].includes(key) ||
              typeof value !== "string" ||
              value.trim().length > 4000
            )
              throw new Error(
                "Next step and help needed must be text of up to 4,000 characters.",
              );
            return [key, value.trim()];
          }),
        );
  const data = insightValues ? normalizeInsight(insightValues) : null;
  if (!scores && !data && !Object.keys(management ?? {}).length)
    throw new Error("Enter an insight or change a score before saving.");
  const assumptionRef = doc(
    db,
    "projects",
    projectId,
    "assumptions",
    assumptionId,
  );
  const reference = doc(collection(assumptionRef, "insights"));
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(assumptionRef);
    if (!snapshot.exists()) throw new Error("This assumption is unavailable.");
    const current = snapshot.data();
    const from = {
      criticality: current.criticality ?? null,
      evidence: current.evidence ?? null,
    };
    const changed =
      scores &&
      (scores.criticality !== from.criticality ||
        scores.evidence !== from.evidence);
    const managementFrom = {
      nextStep: current.nextStep ?? "",
      helpNeeded: current.helpNeeded ?? "",
    };
    const managementTo = { ...managementFrom, ...management };
    const managementChanged = Object.keys(managementFrom).some(
      (key) => managementFrom[key] !== managementTo[key],
    );
    if (!changed && !managementChanged && !data) return null;
    const record = {
      ...(data ?? {}),
      ...(changed && {
        scoreChange: {
          from,
          to: { criticality: scores.criticality, evidence: scores.evidence },
        },
      }),
      ...(managementChanged && {
        managementChange: { from: managementFrom, to: managementTo },
      }),
      createdBy: user.uid,
      authorEmail: user.email,
      createdAt: serverTimestamp(),
    };
    if (changed || managementChanged)
      transaction.update(assumptionRef, {
        ...(changed && {
          criticality: scores.criticality,
          evidence: scores.evidence,
          lastScoreChangeId: reference.id,
        }),
        ...(managementChanged && {
          ...managementTo,
          lastManagementChangeId: reference.id,
        }),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
    transaction.set(reference, record);
    return { ...record, id: reference.id, createdAt: null };
  });
}

export async function loadProjectBrief(projectId) {
  const briefRef = doc(db, "projects", projectId, "projectBrief", "overview");

  const snapshot = await getDoc(briefRef);

  if (!snapshot.exists()) {
    return {
      customerPromise: "",
      investorPromise: "",
      coworkerPromise: "",
    };
  }

  return snapshot.data();
}

export async function updateAssumption(
  user,
  projectId,
  assumptionId,
  statement,
) {
  const assumptionRef = doc(
    db,
    "projects",
    projectId,
    "assumptions",
    assumptionId,
  );

  await updateDoc(assumptionRef, {
    statement: statement.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
}

export async function saveProjectBrief(projectId, userId, promises) {
  const briefRef = doc(db, "projects", projectId, "projectBrief", "overview");

  await setDoc(briefRef, {
    customerPromise: promises.customerPromise.trim(),
    investorPromise: promises.investorPromise.trim(),
    coworkerPromise: promises.coworkerPromise.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

export async function ensureUserProfile(user) {
  const profileRef = doc(db, "users", user.uid);
  const profile = await getDoc(profileRef);
  if (!profile.exists()) {
    await setDoc(profileRef, { createdAt: serverTimestamp() });
  }
}

export async function createProject(user, values) {
  const name = values.name.trim();
  const description = values.description.trim();
  const projectRef = doc(collection(db, "projects"));
  const membershipRef = doc(
    db,
    "users",
    user.uid,
    "projectMemberships",
    projectRef.id,
  );
  const batch = writeBatch(db);
  const project = { name, creatorId: user.uid, createdAt: serverTimestamp() };

  if (description) {
    project.description = description;
  }

  batch.set(projectRef, project);
  batch.set(membershipRef, {
    projectId: projectRef.id,
    userId: user.uid,
    role: "owner",
    active: true,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return projectRef.id;
}

export async function loadProjects(user) {
  const memberships = await getDocs(
    collection(db, "users", user.uid, "projectMemberships"),
  );
  const activeMemberships = memberships.docs.filter(
    (membership) => membership.data().active === true,
  );
  const projects = await Promise.all(
    activeMemberships.map(async (membership) => {
      const project = await getDoc(doc(db, "projects", membership.id));
      return project.exists() ? { id: project.id, ...project.data() } : null;
    }),
  );
  return projects
    .filter(Boolean)
    .sort((first, second) => first.name.localeCompare(second.name));
}

export async function loadAssumptions(projectId) {
  const assumptions = await getDocs(
    collection(db, "projects", projectId, "assumptions"),
  );
  return assumptions.docs.map((assumption) => ({
    id: assumption.id,
    ...assumption.data(),
  }));
}

export async function addBasicAssumption(user, projectId, statement) {
  return addDoc(collection(db, "projects", projectId, "assumptions"), {
    statement: statement.trim(),
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  });
}

export async function loadInsights(projectId, assumptionId) {
  const snapshot = await getDocs(
    collection(
      db,
      "projects",
      projectId,
      "assumptions",
      assumptionId,
      "insights",
    ),
  );
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort(
      (a, b) =>
        (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0) ||
        a.id.localeCompare(b.id),
    );
}

export async function addInsight(user, projectId, assumptionId, values) {
  const data = normalizeInsight(values);
  const record = {
    ...data,
    createdBy: user.uid,
    authorEmail: user.email,
    createdAt: serverTimestamp(),
  };
  const reference = await addDoc(
    collection(
      db,
      "projects",
      projectId,
      "assumptions",
      assumptionId,
      "insights",
    ),
    record,
  );
  // Do not turn a successful write into a failed save if a follow-up read fails.
  return { ...record, id: reference.id, createdAt: null };
}
