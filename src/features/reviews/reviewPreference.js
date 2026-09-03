import {
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase.js";

export function watchReviewPreference(projectId, onChange, onError) {
  return onSnapshot(
    doc(db, "projects", projectId),
    { includeMetadataChanges: true },
    (snapshot) => {
      // Local optimistic writes are not saved preferences. Wait for the
      // acknowledgement metadata event, or retain the prior value on rejection.
      if (snapshot.metadata.hasPendingWrites) return;
      if (!snapshot.exists()) {
        onError(new Error("Project unavailable."));
        return;
      }
      onChange(snapshot.data().formalReviewsEnabled !== false);
    },
    onError,
  );
}

export async function saveReviewPreference(projectId, user, enabled) {
  if (typeof enabled !== "boolean")
    throw new Error("Choose a review preference.");
  await updateDoc(doc(db, "projects", projectId), {
    formalReviewsEnabled: enabled,
    reviewPreferenceUpdatedBy: user.uid,
    reviewPreferenceUpdatedAt: serverTimestamp(),
  });
}
