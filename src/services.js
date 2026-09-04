import {
  assumptionFields,
  editableAssumption,
  prepareAssumptionDraft,
} from "./features/assumptions/assumptionDraft.js";
import { parseCandidates } from "./features/candidates/candidateValues.js";
import { normalizeInsight } from "./features/assumptions/insightValues.js";
import {
  addDoc,
  onSnapshot,
  collection,
  doc,
  getDoc,
  getDocFromServer,
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
  const snapshot = await getDoc(
    doc(db, "projects", projectId, "assumptions", assumptionId),
  );
  if (!snapshot.exists()) throw new Error("This assumption is unavailable.");
  const baseline = snapshot.data();
  return saveAssumptionDraft(
    user,
    projectId,
    assumptionId,
    baseline,
    { ...editableAssumption(baseline), statement },
    null,
  );
}

export function promiseValues(values = {}, trim = true) {
  return Object.fromEntries(
    ["customerPromise", "investorPromise", "coworkerPromise"].map((key) => [
      key,
      trim ? (values[key] ?? "").trim() : (values[key] ?? ""),
    ]),
  );
}

export async function loadPromiseHistory(projectId) {
  const snapshot = await getDocs(
    collection(
      db,
      "projects",
      projectId,
      "projectBrief",
      "overview",
      "history",
    ),
  );
  return snapshot.docs
    .map((item) => ({ ...item.data(), id: item.id }))
    .sort(
      (a, b) =>
        (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0) ||
        a.id.localeCompare(b.id),
    );
}

export async function saveProjectBrief(projectId, user, promises, baseline) {
  const reference = doc(db, "projects", projectId, "projectBrief", "overview");
  const historyRef = doc(collection(reference, "history"));
  const next = promiseValues(promises);
  const expected = promiseValues(baseline, false);
  function check(current) {
    if (
      Object.keys(expected).some(
        (key) => expected[key] !== promiseValues(current, false)[key],
      )
    ) {
      const error = new Error(
        "The promises changed while you were editing. Review the latest saved promises before saving.",
      );
      error.code = "promise-conflict";
      error.current = current;
      throw error;
    }
  }
  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const current = snapshot.exists() ? snapshot.data() : {};
      check(current);
      const before = promiseValues(current, false);
      if (Object.keys(next).every((key) => next[key] === before[key]))
        return current;
      transaction.set(reference, {
        ...next,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
        lastWordingChangeId: historyRef.id,
      });
      transaction.set(historyRef, {
        from: before,
        to: next,
        createdBy: user.uid,
        authorEmail: user.email,
        createdAt: serverTimestamp(),
      });
      return { ...next, lastWordingChangeId: historyRef.id };
    });
  } catch (error) {
    if (error.code === "permission-denied") {
      let latest;
      try {
        latest = await getDocFromServer(reference);
      } catch {
        throw error;
      }
      check(latest.exists() ? latest.data() : {});
    }
    throw error;
  }
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
  const description = (values.description ?? "").trim();
  const projectRef = doc(collection(db, "projects"));
  const membershipRef = doc(
    db,
    "users",
    user.uid,
    "projectMemberships",
    projectRef.id,
  );
  const batch = writeBatch(db);
  const project = {
    name,
    creatorId: user.uid,
    createdAt: serverTimestamp(),
    formalReviewsEnabled: values.formalReviewsEnabled === true,
  };

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

// Membership changes update project navigation and close a removed project.
export function watchProjects(user, onChange, onError) {
  let active = true;
  let revision = 0;
  const unsubscribe = onSnapshot(
    collection(db, "users", user.uid, "projectMemberships"),
    async () => {
      const current = ++revision;
      try {
        const projects = await loadProjects(user);
        if (active && current === revision) onChange(projects);
      } catch (error) {
        if (active && current === revision) onError(error);
      }
    },
    (error) => {
      if (active) onError(error);
    },
  );
  return () => {
    active = false;
    revision += 1;
    unsubscribe();
  };
}

export async function loadCandidates(projectId) {
  const snapshot = await getDocs(
    collection(db, "projects", projectId, "candidates"),
  );
  return snapshot.docs
    .map((item) => ({ ...item.data(), id: item.id }))
    .sort(
      (a, b) =>
        (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0) ||
        a.id.localeCompare(b.id),
    );
}

export async function addCandidates(user, projectId, text) {
  const statements = parseCandidates(text);
  const batch = writeBatch(db);
  const capturedAt = Date.now();
  const records = statements.map((statement, index) => {
    const ref = doc(collection(db, "projects", projectId, "candidates"));
    const record = {
      statement,
      status: "pending",
      groupId: "ungrouped",
      rank: capturedAt + index,
      createdBy: user.uid,
      authorEmail: user.email,
      createdAt: serverTimestamp(),
    };
    batch.set(ref, record);
    return { ...record, id: ref.id, createdAt: null };
  });
  await batch.commit();
  return records;
}

export async function editCandidate(user, projectId, candidateId, statement) {
  const trimmed = statement.trim();
  if (!trimmed || trimmed.length > 2000)
    throw new Error("Enter a candidate of 1–2,000 characters.");
  await updateDoc(doc(db, "projects", projectId, "candidates", candidateId), {
    statement: trimmed,
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
  });
  return trimmed;
}

export async function adoptCandidate(
  user,
  projectId,
  candidateId,
  expectedStatement,
  draft,
  insight = null,
  requestId = crypto.randomUUID(),
) {
  const result = await saveAssumptionDraft(
    user,
    projectId,
    candidateId,
    null,
    { ...draft, statement: expectedStatement },
    insight,
    { id: candidateId, statement: expectedStatement, requestId },
  );
  return result.assumption;
}

// One atomic save for the workspace drawer. Legacy service entry points remain
// available; current drawer writes always include the baseline the user edited.
export async function saveAssumptionDraft(
  user,
  projectId,
  assumptionId,
  baseline,
  draft,
  insight,
  adoption = null,
) {
  const { saved, values, changes, scoresChanged, entry } =
    prepareAssumptionDraft(baseline, draft, insight);
  if (
    adoption &&
    (baseline !== null ||
      adoption.id !== assumptionId ||
      values.statement !== adoption.statement ||
      ![values.criticality, values.evidence].every(
        (value) => Number.isInteger(value) && value >= 0 && value <= 100,
      ))
  )
    throw new Error(
      "Enter both initial scores as whole numbers from 0–100 before adopting.",
    );
  const creating = baseline === null;
  const reference = doc(db, "projects", projectId, "assumptions", assumptionId);
  const insightRef = adoption
    ? doc(reference, "insights", adoption.requestId)
    : doc(collection(reference, "insights"));
  const candidateRef = adoption
    ? doc(db, "projects", projectId, "candidates", adoption.id)
    : null;
  function checkCandidate(candidate, current, history) {
    if (!candidate)
      throw new Error(
        "This candidate is unavailable. Close the drawer and refresh candidates.",
      );
    if (candidate.status === "adopted") {
      const sameRequest =
        candidate.adoptionInsightId === adoption.requestId &&
        candidate.adoptedBy === user.uid;
      const sameValues =
        history &&
        history.createdBy === user.uid &&
        history.scoreChange?.to.criticality === values.criticality &&
        history.scoreChange?.to.evidence === values.evidence &&
        (history.managementChange?.to.nextStep ?? "") === values.nextStep &&
        (history.managementChange?.to.helpNeeded ?? "") === values.helpNeeded &&
        ["description", "sourceUrl", "classification"].every(
          (key) => (history[key] ?? null) === (entry?.[key] ?? null),
        );
      if (
        sameRequest &&
        sameValues &&
        candidate.statement === values.statement &&
        current?.sourceCandidateId === adoption.id
      )
        return { assumption: { ...current, id: assumptionId }, insight: null };
      const error = new Error(
        "This candidate has already been adopted. Your draft is retained. Close the drawer and refresh candidates to review the saved assumption.",
      );
      error.code = "candidate-adopted";
      throw error;
    }
    if (
      candidate.status !== "pending" ||
      candidate.statement !== adoption.statement
    ) {
      const error = new Error(
        "This candidate was edited by someone else. Review its latest wording before adopting.",
      );
      error.code = "candidate-conflict";
      error.current = { ...candidate, id: adoption.id };
      throw error;
    }
    return null;
  }
  function assertBaseline(current) {
    if (!current) return;
    const before = editableAssumption(current);
    // Wording is context for every save, including insight-only saves. Both
    // scores are checked together whenever the score pair is being edited.
    const checked = new Set([
      "statement",
      ...Object.keys(changes),
      ...(scoresChanged ? ["criticality", "evidence"] : []),
    ]);
    const conflicts =
      current && [...checked].filter((key) => before[key] !== saved[key]);
    if ((creating && current) || (!creating && conflicts.length)) {
      const error = new Error(
        "This assumption changed while you were editing. Review the saved values before trying again.",
      );
      error.code = "assumption-conflict";
      error.current = { ...current, id: assumptionId };
      error.fields = creating ? Object.keys(assumptionFields) : conflicts;
      throw error;
    }
  }
  const commit = () =>
    runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const current = snapshot.exists() ? snapshot.data() : null;
      if (adoption) {
        const candidate = await transaction.get(candidateRef);
        const history = await transaction.get(insightRef);
        const completed = checkCandidate(
          candidate.exists() ? candidate.data() : null,
          current,
          history.exists() ? history.data() : null,
        );
        if (completed) return completed;
      }
      if (!creating && !current)
        throw new Error("This assumption is unavailable.");
      assertBaseline(current);
      const before = editableAssumption(current ?? {});
      const after = { ...before, ...changes };
      const scoreChange =
        scoresChanged &&
        (before.criticality !== after.criticality ||
          before.evidence !== after.evidence);
      const managementChange =
        before.nextStep !== after.nextStep ||
        before.helpNeeded !== after.helpNeeded;
      const wordingChange = !creating && before.statement !== after.statement;
      const record =
        entry || scoreChange || managementChange || wordingChange
          ? {
              ...(entry ?? {}),
              ...(wordingChange
                ? {
                    wordingChange: {
                      from: before.statement,
                      to: after.statement,
                    },
                  }
                : {}),
              ...(scoreChange
                ? {
                    scoreChange: {
                      from: {
                        criticality: before.criticality,
                        evidence: before.evidence,
                      },
                      to: {
                        criticality: after.criticality,
                        evidence: after.evidence,
                      },
                    },
                  }
                : {}),
              ...(managementChange
                ? {
                    managementChange: {
                      from: {
                        nextStep: before.nextStep,
                        helpNeeded: before.helpNeeded,
                      },
                      to: {
                        nextStep: after.nextStep,
                        helpNeeded: after.helpNeeded,
                      },
                    },
                  }
                : {}),
              createdBy: user.uid,
              authorEmail: user.email,
              createdAt: serverTimestamp(),
            }
          : null;
      const pointers = {
        ...(wordingChange ? { lastWordingChangeId: insightRef.id } : {}),
        ...(scoreChange ? { lastScoreChangeId: insightRef.id } : {}),
        ...(managementChange ? { lastManagementChangeId: insightRef.id } : {}),
      };
      let result;
      if (creating) {
        const data = {
          ...(adoption ? { sourceCandidateId: adoption.id } : {}),
          statement: values.statement,
          ...(scoresChanged
            ? { criticality: values.criticality, evidence: values.evidence }
            : {}),
          ...(values.nextStep ? { nextStep: values.nextStep } : {}),
          ...(values.helpNeeded ? { helpNeeded: values.helpNeeded } : {}),
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          ...(record
            ? { updatedBy: user.uid, updatedAt: serverTimestamp(), ...pointers }
            : {}),
        };
        transaction.set(reference, data);
        result = {
          ...data,
          createdAt: null,
          ...(record ? { updatedAt: null } : {}),
        };
      } else {
        const update = Object.keys(changes).length
          ? {
              ...changes,
              ...pointers,
              updatedBy: user.uid,
              updatedAt: serverTimestamp(),
            }
          : null;
        if (update) transaction.update(reference, update);
        result = {
          ...current,
          ...update,
          ...(update ? { updatedAt: null } : {}),
        };
      }
      if (record) transaction.set(insightRef, record);
      if (adoption)
        transaction.update(candidateRef, {
          status: "adopted",
          adoptedBy: user.uid,
          adoptedAt: serverTimestamp(),
          adoptionInsightId: insightRef.id,
        });
      return {
        assumption: { ...result, id: assumptionId },
        insight: record
          ? { ...record, id: insightRef.id, createdAt: null }
          : null,
      };
    });
  try {
    return await commit();
  } catch (error) {
    if (error.code !== "permission-denied") throw error;
    // Matching-history rules may reject a racing commit before the SDK retries
    // its transaction. Read current authorized state to identify that conflict;
    // never retry a denied write or relax the history checks.
    let latest;
    try {
      latest = await getDocFromServer(reference);
    } catch {
      throw error;
    }
    if (adoption) {
      const [candidate, history] = await Promise.all([
        getDocFromServer(candidateRef),
        getDocFromServer(insightRef),
      ]);
      const completed = checkCandidate(
        candidate.exists() ? candidate.data() : null,
        latest.exists() ? latest.data() : null,
        history.exists() ? history.data() : null,
      );
      if (completed) return completed;
    }
    if (latest.exists()) assertBaseline(latest.data());
    throw error;
  }
}
