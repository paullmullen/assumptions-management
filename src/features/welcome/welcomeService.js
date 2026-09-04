import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase.js";

function reference(userId, projectId) {
  return doc(db, "users", userId, "projectWelcome", projectId);
}
export async function hasSeenWelcome(userId, projectId) {
  const snapshot = await getDoc(reference(userId, projectId));
  return snapshot.exists() && snapshot.data().version === 1;
}
export async function rememberWelcome(userId, projectId) {
  await setDoc(reference(userId, projectId), {
    version: 1,
    seenAt: serverTimestamp(),
  });
}
