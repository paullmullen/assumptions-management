import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../../firebase.js";

export function normalizeEmail(value) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Enter a valid email address.");
  return email;
}

export async function inviteMember(user, projectId, email) {
  const recipientEmail = normalizeEmail(email);
  if (recipientEmail === user.email.toLowerCase())
    throw new Error("You already own this project.");
  const reference = doc(collection(db, "projectInvitations"));
  await setDoc(reference, {
    projectId,
    recipientEmail,
    invitedBy: user.uid,
    inviterEmail: user.email,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: "pending",
  });
  return reference.id;
}

export async function loadMembers(projectId) {
  const snapshot = await getDocs(
    collection(db, "projects", projectId, "members"),
  );
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
}

export async function loadInvitations(projectId) {
  const snapshot = await getDocs(
    query(
      collection(db, "projectInvitations"),
      where("projectId", "==", projectId),
    ),
  );
  return snapshot.docs
    .map((item) => ({ ...item.data(), id: item.id }))
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

export async function loadInvitation(id) {
  const snapshot = await getDoc(doc(db, "projectInvitations", id));
  if (!snapshot.exists()) throw new Error("This invitation is unavailable.");
  return { ...snapshot.data(), id: snapshot.id };
}

export async function revokeInvitation(id) {
  await updateDoc(doc(db, "projectInvitations", id), {
    status: "revoked",
    revokedAt: serverTimestamp(),
  });
}

export async function acceptInvitation(user, id) {
  const reference = doc(db, "projectInvitations", id);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("This invitation is unavailable.");
    const invite = snapshot.data();
    if (invite.recipientEmail !== user.email.toLowerCase())
      throw new Error("Sign in with the invited email address.");
    const memberRef = doc(
      db,
      "users",
      user.uid,
      "projectMemberships",
      invite.projectId,
    );
    const member = await transaction.get(memberRef);
    if (
      invite.status === "accepted" &&
      invite.acceptedBy === user.uid &&
      member.data()?.active
    )
      return invite.projectId;
    if (invite.status !== "pending")
      throw new Error("This invitation is no longer pending.");
    // Expiration is decided using server request.time by Firestore rules.
    if (
      !member.data()?.active &&
      member.data()?.removedAt &&
      invite.createdAt.toMillis() <= member.data().removedAt.toMillis()
    )
      throw new Error(
        "Your access was removed after this invitation was issued. Ask the owner for a new link.",
      );
    if (!member.data()?.active) {
      const data = {
        projectId: invite.projectId,
        userId: user.uid,
        role: "member",
        active: true,
        createdAt: serverTimestamp(),
        invitationId: id,
        email: invite.recipientEmail,
      };
      transaction.set(memberRef, data);
      transaction.set(
        doc(db, "projects", invite.projectId, "members", user.uid),
        data,
      );
    }
    transaction.update(reference, {
      status: "accepted",
      acceptedBy: user.uid,
      acceptedAt: serverTimestamp(),
    });
    return invite.projectId;
  });
}

export async function removeMember(user, projectId, userId) {
  const reference = doc(db, "users", userId, "projectMemberships", projectId);
  const eventRef = doc(collection(db, "projects", projectId, "memberRemovals"));
  await runTransaction(db, async (transaction) => {
    const member = await transaction.get(reference);
    if (!member.exists() || !member.data().active) return;
    if (member.data().role !== "member")
      throw new Error("The project owner cannot be removed.");
    const data = {
      ...member.data(),
      active: false,
      removedAt: serverTimestamp(),
      removedBy: user.uid,
      lastRemovalId: eventRef.id,
    };
    transaction.set(reference, data);
    transaction.set(doc(db, "projects", projectId, "members", userId), data);
    transaction.set(eventRef, {
      memberId: userId,
      removedBy: user.uid,
      removedAt: serverTimestamp(),
    });
  });
}
