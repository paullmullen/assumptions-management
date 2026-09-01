import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
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
) {
  const { criticality, evidence } = scores;

  if (
    !Number.isInteger(criticality) ||
    criticality < 0 ||
    criticality > 100 ||
    !Number.isInteger(evidence) ||
    evidence < 0 ||
    evidence > 100
  ) {
    throw new RangeError("Assumption scores must be integers from 0 to 100.");
  }

  const assumptionRef = doc(
    db,
    "projects",
    projectId,
    "assumptions",
    assumptionId,
  );

  await updateDoc(assumptionRef, {
    criticality,
    evidence,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
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
