import {
  loadReportSource,
  loadReportComparison,
  loadReportReviews,
  verifyReportAccess,
} from "../../src/features/reports/reportService.js";
import { captureReview } from "../../src/features/reviews/reviewService.js";
import { readFileSync } from "node:fs";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import {
  updateAssumptionScores,
  updateAssumption,
  saveProjectBrief,
  loadPromiseHistory,
  saveAssumptionChanges,
  saveAssumptionDraft,
  addInsight,
  addCandidates,
  editCandidate,
  adoptCandidate as adoptCandidateWithScores,
  loadCandidates,
  loadAssumptions,
} from "../../src/services.js";
// Legacy workflow cases now exercise adoption with deliberate initial scores.
const adoptCandidate = (user, project, id, statement) =>
  adoptCandidateWithScores(
    user,
    project,
    id,
    statement,
    { criticality: 0, evidence: 0 },
    null,
    "test-adoption",
  );
let serviceDb;
vi.mock("../../src/firebase.js", () => ({
  get db() {
    return serviceDb;
  },
}));

const projectId = "project-a";
const ownerId = "owner-a";
const otherUserId = "user-b";
let testEnv;
const [emulatorHost, emulatorPort] = (
  process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080"
).split(":");

function project(owner = ownerId, name = "Private project") {
  return { name, creatorId: owner, createdAt: Timestamp.now() };
}

function membership(projectKey, userId, role = "owner") {
  return {
    projectId: projectKey,
    userId,
    role,
    active: true,
    createdAt: Timestamp.now(),
  };
}

function projectBrief(updatedBy = ownerId) {
  return {
    customerPromise: "Customers will complete the process more quickly.",
    investorPromise: "The project will produce a sustainable return.",
    coworkerPromise: "The team will have a healthy working environment.",
    updatedAt: Timestamp.now(),
    updatedBy,
  };
}

function verifiedContext(userId) {
  return testEnv.authenticatedContext(userId, { email_verified: true });
}

async function createPrivateProject(context, id = projectId, owner = ownerId) {
  const firestore = context.firestore();
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, "projects", id), project(owner));
  batch.set(
    doc(firestore, "users", owner, "projectMemberships", id),
    membership(id, owner),
  );
  return batch.commit();
}

async function seedPrivateProject(id = projectId, owner = ownerId) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await setDoc(doc(firestore, "projects", id), project(owner));
    await setDoc(
      doc(firestore, "users", owner, "projectMemberships", id),
      membership(id, owner),
    );
  });
}

async function adminDocument(path) {
  let snapshot;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    snapshot = await getDoc(doc(context.firestore(), path));
  });
  return snapshot;
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "assumptions-management",
    firestore: {
      host: emulatorHost,
      port: Number(emulatorPort),
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Slice 1 Firestore security rules", () => {
  it("atomically creates a private project with its initial owner membership", async () => {
    await assertSucceeds(createPrivateProject(verifiedContext(ownerId)));
    expect((await adminDocument(`projects/${projectId}`)).exists()).toBe(true);
    expect(
      (
        await adminDocument(`users/${ownerId}/projectMemberships/${projectId}`)
      ).exists(),
    ).toBe(true);
  });

  it("rejects an orphan project and commits none of its writes", async () => {
    const firestore = verifiedContext(ownerId).firestore();
    await assertFails(setDoc(doc(firestore, "projects", projectId), project()));
    expect((await adminDocument(`projects/${projectId}`)).exists()).toBe(false);
  });

  it("rejects an orphan membership and commits none of its writes", async () => {
    const firestore = verifiedContext(ownerId).firestore();
    await assertFails(
      setDoc(
        doc(firestore, "users", ownerId, "projectMemberships", projectId),
        membership(projectId, ownerId),
      ),
    );
    expect(
      (
        await adminDocument(`users/${ownerId}/projectMemberships/${projectId}`)
      ).exists(),
    ).toBe(false);
  });

  it("rejects a batch with a project but a mismatched membership and commits neither", async () => {
    const firestore = verifiedContext(ownerId).firestore();
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, "projects", projectId), project());
    batch.set(
      doc(
        firestore,
        "users",
        ownerId,
        "projectMemberships",
        "different-project",
      ),
      membership("different-project", ownerId),
    );
    await assertFails(batch.commit());
    expect((await adminDocument(`projects/${projectId}`)).exists()).toBe(false);
    expect(
      (
        await adminDocument(
          `users/${ownerId}/projectMemberships/different-project`,
        )
      ).exists(),
    ).toBe(false);
  });

  it("rejects fraudulent ownership for another user and for an existing project", async () => {
    const otherFirestore = verifiedContext(otherUserId).firestore();
    await assertFails(
      setDoc(
        doc(otherFirestore, "users", ownerId, "projectMemberships", projectId),
        membership(projectId, ownerId),
      ),
    );
    await seedPrivateProject();
    await assertFails(
      setDoc(
        doc(
          otherFirestore,
          "users",
          otherUserId,
          "projectMemberships",
          projectId,
        ),
        membership(projectId, otherUserId),
      ),
    );
    expect(
      (
        await adminDocument(
          `users/${otherUserId}/projectMemberships/${projectId}`,
        )
      ).exists(),
    ).toBe(false);
  });

  it("prevents clients from changing project identity and all existing membership fields", async () => {
    await seedPrivateProject();
    const firestore = verifiedContext(ownerId).firestore();
    await assertFails(
      updateDoc(doc(firestore, "projects", projectId), {
        creatorId: otherUserId,
      }),
    );
    await assertFails(
      updateDoc(
        doc(firestore, "users", ownerId, "projectMemberships", projectId),
        { active: false },
      ),
    );
    await assertFails(
      updateDoc(
        doc(firestore, "users", ownerId, "projectMemberships", projectId),
        { role: "member" },
      ),
    );
    await assertFails(
      updateDoc(
        doc(firestore, "users", ownerId, "projectMemberships", projectId),
        { projectId: "another-project" },
      ),
    );
    await assertFails(
      updateDoc(
        doc(firestore, "users", ownerId, "projectMemberships", projectId),
        { userId: otherUserId },
      ),
    );
  });

  it("allows an active member to add and read a basic assumption", async () => {
    await seedPrivateProject();
    const firestore = verifiedContext(ownerId).firestore();
    const assumption = doc(
      firestore,
      "projects",
      projectId,
      "assumptions",
      "assumption-a",
    );
    await assertSucceeds(
      setDoc(assumption, {
        statement: "Customers will benefit from a faster handoff.",
        createdBy: ownerId,
        createdAt: Timestamp.now(),
      }),
    );
    await assertSucceeds(getDoc(assumption));
  });

  it("allows an active member to save and revise the project brief", async () => {
    await seedPrivateProject();

    const firestore = verifiedContext(ownerId).firestore();
    const briefRef = doc(
      firestore,
      "projects",
      projectId,
      "projectBrief",
      "overview",
    );

    serviceDb = testEnv
      .authenticatedContext(ownerId, {
        email_verified: true,
        email: "owner@example.com",
      })
      .firestore();
    const actor = { uid: ownerId, email: "owner@example.com" };
    await assertSucceeds(
      saveProjectBrief(projectId, actor, projectBrief(), {}),
    );
    await assertSucceeds(
      saveProjectBrief(
        projectId,
        actor,
        {
          ...projectBrief(),
          customerPromise:
            "Customers will complete the process more confidently.",
        },
        projectBrief(),
      ),
    );
    await assertSucceeds(getDoc(briefRef));
  });

  it("denies nonmember access and false attribution on project briefs", async () => {
    await seedPrivateProject();

    const ownerFirestore = verifiedContext(ownerId).firestore();
    const otherFirestore = verifiedContext(otherUserId).firestore();
    const ownerBriefRef = doc(
      ownerFirestore,
      "projects",
      projectId,
      "projectBrief",
      "overview",
    );
    const otherBriefRef = doc(
      otherFirestore,
      "projects",
      projectId,
      "projectBrief",
      "overview",
    );

    await assertFails(setDoc(ownerBriefRef, projectBrief(otherUserId)));
    await assertFails(setDoc(otherBriefRef, projectBrief(otherUserId)));
    await assertFails(getDoc(otherBriefRef));
  });

  it("denies unverified and nonmember project discovery, reads, queries, and writes", async () => {
    await seedPrivateProject();
    const unverified = testEnv.authenticatedContext("unverified").firestore();
    const nonmember = verifiedContext(otherUserId).firestore();
    const projectRef = doc(nonmember, "projects", projectId);
    const assumptionRef = doc(
      nonmember,
      "projects",
      projectId,
      "assumptions",
      "forbidden",
    );

    await assertFails(getDoc(doc(unverified, "projects", projectId)));
    await assertFails(getDoc(projectRef));
    await assertFails(getDocs(collection(nonmember, "projects")));
    await assertFails(
      getDocs(collection(nonmember, "projects", projectId, "assumptions")),
    );
    await assertFails(
      setDoc(assumptionRef, {
        statement: "I should not be able to add this.",
        createdBy: otherUserId,
        createdAt: Timestamp.now(),
      }),
    );
  });

  it("allows an active member to edit an assumption without changing its identity", async () => {
    await seedPrivateProject();

    const firestore = verifiedContext(ownerId).firestore();
    const assumptionRef = doc(
      firestore,
      "projects",
      projectId,
      "assumptions",
      "editable-assumption",
    );

    await assertSucceeds(
      setDoc(assumptionRef, {
        statement: "Customers will complete the workflow successfully.",
        createdBy: ownerId,
        createdAt: Timestamp.now(),
      }),
    );

    serviceDb = testEnv
      .authenticatedContext(ownerId, {
        email_verified: true,
        email: "owner@example.com",
      })
      .firestore();
    await assertSucceeds(
      updateAssumption(
        { uid: ownerId, email: "owner@example.com" },
        projectId,
        "editable-assumption",
        "Customers will complete the workflow without assistance.",
      ),
    );

    const snapshot = await getDoc(assumptionRef);

    expect(snapshot.data().statement).toBe(
      "Customers will complete the workflow without assistance.",
    );
    expect(snapshot.data().createdBy).toBe(ownerId);
  });

  it("allows an active member to create a scored assumption", async () => {
    await seedPrivateProject();

    const firestore = verifiedContext(ownerId).firestore();
    const assumptionRef = doc(
      firestore,
      "projects",
      projectId,
      "assumptions",
      "scored-assumption",
    );

    await assertSucceeds(
      setDoc(assumptionRef, {
        statement: "Customers will adopt the new workflow.",
        criticality: 85,
        evidence: 30,
        createdBy: ownerId,
        createdAt: Timestamp.now(),
      }),
    );

    const snapshot = await getDoc(assumptionRef);

    expect(snapshot.data().criticality).toBe(85);
    expect(snapshot.data().evidence).toBe(30);
  });

  it("allows an active member to score an existing unscored assumption", async () => {
    await seedPrivateProject();

    const firestore = verifiedContext(ownerId).firestore();
    const assumptionRef = doc(
      firestore,
      "projects",
      projectId,
      "assumptions",
      "legacy-assumption",
    );

    await assertSucceeds(
      setDoc(assumptionRef, {
        statement: "The implementation partner will meet the schedule.",
        createdBy: ownerId,
        createdAt: Timestamp.now(),
      }),
    );

    serviceDb = testEnv
      .authenticatedContext(ownerId, {
        email_verified: true,
        email: "owner@example.com",
      })
      .firestore();
    await assertSucceeds(
      updateAssumptionScores(
        { uid: ownerId, email: "owner@example.com" },
        projectId,
        "legacy-assumption",
        { criticality: 90, evidence: 20 },
      ),
    );

    const snapshot = await getDoc(assumptionRef);

    expect(snapshot.data().criticality).toBe(90);
    expect(snapshot.data().evidence).toBe(20);
    expect(snapshot.data().createdBy).toBe(ownerId);
  });

  it("rejects invalid assumption scores and unknown fields", async () => {
    await seedPrivateProject();

    const firestore = verifiedContext(ownerId).firestore();

    const invalidRangeRef = doc(
      firestore,
      "projects",
      projectId,
      "assumptions",
      "invalid-range",
    );

    await assertFails(
      setDoc(invalidRangeRef, {
        statement: "This score is too high.",
        criticality: 101,
        evidence: 50,
        createdBy: ownerId,
        createdAt: Timestamp.now(),
      }),
    );

    const decimalRef = doc(
      firestore,
      "projects",
      projectId,
      "assumptions",
      "decimal-score",
    );

    await assertFails(
      setDoc(decimalRef, {
        statement: "This score is not an integer.",
        criticality: 50,
        evidence: 25.5,
        createdBy: ownerId,
        createdAt: Timestamp.now(),
      }),
    );

    const unknownFieldRef = doc(
      firestore,
      "projects",
      projectId,
      "assumptions",
      "unknown-field",
    );

    await assertFails(
      setDoc(unknownFieldRef, {
        statement: "This contains an unsupported field.",
        criticality: 50,
        evidence: 50,
        unsupported: true,
        createdBy: ownerId,
        createdAt: Timestamp.now(),
      }),
    );
  });

  it("rejects nonmember edits and changes to assumption identity", async () => {
    await seedPrivateProject();

    const ownerFirestore = verifiedContext(ownerId).firestore();
    const otherFirestore = verifiedContext(otherUserId).firestore();

    const ownerAssumptionRef = doc(
      ownerFirestore,
      "projects",
      projectId,
      "assumptions",
      "protected-assumption",
    );

    const otherAssumptionRef = doc(
      otherFirestore,
      "projects",
      projectId,
      "assumptions",
      "protected-assumption",
    );

    await assertSucceeds(
      setDoc(ownerAssumptionRef, {
        statement: "Customers will adopt the new process.",
        createdBy: ownerId,
        createdAt: Timestamp.now(),
      }),
    );

    await assertFails(
      updateDoc(ownerAssumptionRef, {
        createdBy: otherUserId,
        updatedAt: Timestamp.now(),
        updatedBy: ownerId,
      }),
    );

    await assertFails(
      updateDoc(ownerAssumptionRef, {
        statement: "A falsely attributed edit.",
        updatedAt: Timestamp.now(),
        updatedBy: otherUserId,
      }),
    );

    await assertFails(
      updateDoc(otherAssumptionRef, {
        statement: "A nonmember edit.",
        updatedAt: Timestamp.now(),
        updatedBy: otherUserId,
      }),
    );
  });
});

describe("New Insights security", () => {
  const path = `projects/${projectId}/assumptions/a/insights/i`;
  const actor = () =>
    testEnv
      .authenticatedContext(ownerId, {
        email_verified: true,
        email: "owner@example.com",
      })
      .firestore();
  const insight = () => ({
    description: "Revised judgment after a customer discussion.",
    createdBy: ownerId,
    authorEmail: "owner@example.com",
    createdAt: serverTimestamp(),
  });
  beforeEach(async () => {
    await seedPrivateProject();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), `projects/${projectId}/assumptions/a`),
        {
          statement: "We can deliver.",
          createdBy: ownerId,
          createdAt: Timestamp.now(),
          criticality: 80,
          evidence: 20,
        },
      );
    });
  });
  it("appends and reads insights without changing scores; attribution and date are retained", async () => {
    const db = actor();
    await assertSucceeds(setDoc(doc(db, path), insight()));
    await assertSucceeds(
      setDoc(doc(db, path + "2"), {
        ...insight(),
        sourceUrl: "https://example.com/report",
        classification: "Mitigation / project change",
      }),
    );
    const record = await assertSucceeds(getDoc(doc(db, path)));
    expect(record.data().createdBy).toBe(ownerId);
    expect(record.data().createdAt).toBeInstanceOf(Timestamp);
    await assertSucceeds(
      getDocs(collection(db, `projects/${projectId}/assumptions/a/insights`)),
    );
    const assumption = await getDoc(
      doc(db, `projects/${projectId}/assumptions/a`),
    );
    expect(assumption.data()).toMatchObject({ criticality: 80, evidence: 20 });
    await assertFails(updateDoc(doc(db, path), { description: "Overwrite" }));
    await assertFails(deleteDoc(doc(db, path)));
  });
  it("rejects malformed fields, false attribution, client dates and absent parents", async () => {
    const db = actor();
    for (const patch of [
      { description: "" },
      { description: "   \n" },
      { description: "x".repeat(4001) },
      { createdBy: otherUserId },
      { authorEmail: "fake@example.com" },
      { createdAt: Timestamp.fromMillis(1) },
      { sourceUrl: "javascript:alert(1)" },
      { sourceUrl: "https://" },
      { sourceUrl: "https://example.com/" + "x".repeat(2000) },
      { classification: "required" },
      { evidence: 100 },
    ]) {
      await assertFails(setDoc(doc(db, path), { ...insight(), ...patch }));
    }
    await assertFails(
      setDoc(
        doc(db, `projects/${projectId}/assumptions/missing/insights/i`),
        insight(),
      ),
    );
  });
  it("denies anonymous, unverified, inactive and other-project members reads, queries and writes", async () => {
    await setDoc(doc(actor(), path), insight());
    await seedPrivateProject("project-b", otherUserId);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(
          context.firestore(),
          `users/inactive/projectMemberships/${projectId}`,
        ),
        { ...membership(projectId, "inactive"), active: false },
      );
    });
    const contexts = [
      testEnv.unauthenticatedContext(),
      testEnv.authenticatedContext(ownerId, {
        email_verified: false,
        email: "owner@example.com",
      }),
      verifiedContext(otherUserId),
      verifiedContext("inactive"),
    ];
    for (const context of contexts) {
      const db = context.firestore();
      await assertFails(getDoc(doc(db, path)));
      await assertFails(
        getDocs(collection(db, `projects/${projectId}/assumptions/a/insights`)),
      );
      await assertFails(setDoc(doc(db, path + "new"), insight()));
    }
  });
});

describe("Score notes service with Firestore rules", () => {
  const user = { uid: ownerId, email: "owner@example.com" };
  const parent = `projects/${projectId}/assumptions/score-note`;
  beforeEach(async () => {
    await seedPrivateProject();
    serviceDb = testEnv
      .authenticatedContext(ownerId, {
        email_verified: true,
        email: user.email,
      })
      .firestore();
    await setDoc(doc(serviceDb, parent), {
      statement: "Customers will adopt it.",
      createdBy: ownerId,
      createdAt: Timestamp.now(),
      criticality: 80,
      evidence: 20,
    });
  });
  it.each([
    { criticality: 80, evidence: 60 },
    { criticality: 70, evidence: 20 },
  ])(
    "saves a score change and attributed note together: %o",
    async (scores) => {
      await updateAssumptionScores(
        user,
        projectId,
        "score-note",
        scores,
        " Updated judgment ",
      );
      expect((await getDoc(doc(serviceDb, parent))).data()).toMatchObject(
        scores,
      );
      const records = await getDocs(collection(serviceDb, parent, "insights"));
      expect(records.size).toBe(1);
      expect(records.docs[0].data()).toMatchObject({
        description: "Updated judgment",
        createdBy: ownerId,
        authorEmail: user.email,
      });
      expect(records.docs[0].data().createdAt).toBeInstanceOf(Timestamp);
      expect(
        records.docs[0]
          .data()
          .createdAt.isEqual(
            (await getDoc(doc(serviceDb, parent))).data().updatedAt,
          ),
      ).toBe(true);
    },
  );
  it("commits neither scores nor note when note attribution is rejected", async () => {
    await assertFails(
      updateAssumptionScores(
        { ...user, email: "forged@example.com" },
        projectId,
        "score-note",
        { criticality: 99, evidence: 99 },
        "Rejected note",
      ),
    );
    expect((await getDoc(doc(serviceDb, parent))).data()).toMatchObject({
      criticality: 80,
      evidence: 20,
    });
    expect(
      (await getDocs(collection(serviceDb, parent, "insights"))).empty,
    ).toBe(true);
  });
  it("the unified save adds a note without changing any assumption fields", async () => {
    const before = (await getDoc(doc(serviceDb, parent))).data();
    await saveAssumptionChanges(user, projectId, "score-note", null, {
      description: "Insight only",
      sourceUrl: "https://example.com",
      classification: "Revised judgment",
    });
    expect((await getDoc(doc(serviceDb, parent))).data()).toEqual(before);
    const entries = await getDocs(collection(serviceDb, parent, "insights"));
    expect(entries.size).toBe(1);
    expect(entries.docs[0].data()).toMatchObject({
      description: "Insight only",
      authorEmail: user.email,
      createdBy: ownerId,
      classification: "Revised judgment",
    });
    expect(entries.docs[0].data().createdAt).toBeInstanceOf(Timestamp);
  });
  it("the unified save allows classification alone when a score changes", async () => {
    const baseline = (await getDoc(doc(serviceDb, parent))).data();
    const entry = await saveAssumptionDraft(
      user,
      projectId,
      "score-note",
      baseline,
      { ...baseline, evidence: 30 },
      { classification: "Revised judgment" },
    );
    expect(entry.insight).toMatchObject({
      classification: "Revised judgment",
      scoreChange: {
        from: { criticality: 80, evidence: 20 },
        to: { criticality: 80, evidence: 30 },
      },
    });
    expect(entry.insight.description).toBeUndefined();
  });
  it("the unified save supports insights on an unassessed assumption", async () => {
    const ref = doc(serviceDb, `projects/${projectId}/assumptions/unassessed`);
    await setDoc(ref, {
      statement: "We can support it.",
      createdBy: ownerId,
      createdAt: Timestamp.now(),
    });
    const before = (await getDoc(ref)).data();
    await saveAssumptionChanges(user, projectId, "unassessed", null, {
      description: "Learning without scores",
    });
    expect((await getDoc(ref)).data()).toEqual(before);
  });
  it("the unified save rejects empty submissions and invalid notes without changing scores", async () => {
    await expect(
      saveAssumptionChanges(user, projectId, "score-note", null, null),
    ).rejects.toThrow();
    await expect(
      saveAssumptionChanges(
        user,
        projectId,
        "score-note",
        { criticality: 99, evidence: 99 },
        { description: " " },
      ),
    ).rejects.toThrow();
    expect((await getDoc(doc(serviceDb, parent))).data()).toMatchObject({
      criticality: 80,
      evidence: 20,
    });
    expect(
      (await getDocs(collection(serviceDb, parent, "insights"))).empty,
    ).toBe(true);
  });
  it("still permits score-only and note-only service calls", async () => {
    await updateAssumptionScores(user, projectId, "score-note", {
      criticality: 80,
      evidence: 60,
    });
    expect(
      (await getDocs(collection(serviceDb, parent, "insights"))).size,
    ).toBe(1);
    const before = (await getDoc(doc(serviceDb, parent))).data();
    await addInsight(user, projectId, "score-note", {
      description: "Learning without changing scores",
    });
    expect((await getDoc(doc(serviceDb, parent))).data()).toEqual(before);
    expect(
      (await getDocs(collection(serviceDb, parent, "insights"))).size,
    ).toBe(2);
  });
  it("records from/to for score-only changes, skips no-ops, and reads current stored scores", async () => {
    const first = await saveAssumptionChanges(
      user,
      projectId,
      "score-note",
      { criticality: 80, evidence: 60 },
      null,
    );
    expect(first.scoreChange).toEqual({
      from: { criticality: 80, evidence: 20 },
      to: { criticality: 80, evidence: 60 },
    });
    expect(first.description).toBeUndefined();
    const second = await saveAssumptionChanges(
      user,
      projectId,
      "score-note",
      { criticality: 75, evidence: 65 },
      { description: "Both changed" },
    );
    expect(second.scoreChange.from).toEqual(first.scoreChange.to);
    expect(second.scoreChange.to).toEqual({ criticality: 75, evidence: 65 });
    expect(
      await saveAssumptionChanges(
        user,
        projectId,
        "score-note",
        { criticality: 75, evidence: 65 },
        null,
      ),
    ).toBeNull();
    const note = await saveAssumptionChanges(
      user,
      projectId,
      "score-note",
      { criticality: 75, evidence: 65 },
      { description: "No movement" },
    );
    expect(note.scoreChange).toBeUndefined();
    expect(
      (await getDocs(collection(serviceDb, parent, "insights"))).size,
    ).toBe(3);
  });
  it("records initial assessment with null from-values", async () => {
    await setDoc(doc(serviceDb, `projects/${projectId}/assumptions/new`), {
      statement: "New",
      createdBy: ownerId,
      createdAt: Timestamp.now(),
    });
    const entry = await saveAssumptionChanges(
      user,
      projectId,
      "new",
      { criticality: 80, evidence: 20 },
      null,
    );
    expect(entry.scoreChange.from).toEqual({
      criticality: null,
      evidence: null,
    });
  });
  it("rejects missing history, forged before/after values, and standalone score records", async () => {
    await assertFails(
      updateDoc(doc(serviceDb, parent), {
        criticality: 75,
        evidence: 60,
        updatedBy: ownerId,
        updatedAt: serverTimestamp(),
      }),
    );
    const entryRef = doc(serviceDb, parent, "insights", "forged");
    const valid = {
      createdBy: ownerId,
      authorEmail: user.email,
      createdAt: serverTimestamp(),
      scoreChange: {
        from: { criticality: 80, evidence: 20 },
        to: { criticality: 75, evidence: 60 },
      },
    };
    await assertFails(setDoc(entryRef, valid));
    for (const scoreChange of [
      {
        from: { criticality: 1, evidence: 20 },
        to: { criticality: 75, evidence: 60 },
      },
      {
        from: { criticality: 80, evidence: 20 },
        to: { criticality: 75, evidence: 99 },
      },
    ]) {
      const batch = writeBatch(serviceDb);
      batch.update(doc(serviceDb, parent), {
        criticality: 75,
        evidence: 60,
        updatedAt: serverTimestamp(),
        updatedBy: ownerId,
        lastScoreChangeId: "forged",
      });
      batch.set(entryRef, { ...valid, scoreChange });
      await assertFails(batch.commit());
    }
    expect((await getDoc(doc(serviceDb, parent))).data().criticality).toBe(80);
  });
  it("keeps concurrent history consistent, including retry after a rejected conflict", async () => {
    const targets = [
      { criticality: 70, evidence: 30 },
      { criticality: 60, evidence: 40 },
    ];
    const results = await Promise.allSettled(
      targets.map((scores) =>
        saveAssumptionChanges(user, projectId, "score-note", scores, null),
      ),
    );
    const entries = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    expect(entries.length).toBeGreaterThan(0);
    // Rules may reject a stale transaction before the emulator reports a retryable
    // conflict. The UI retains that draft; a user retry must read the new baseline.
    for (let index = 0; index < results.length; index++) {
      if (results[index].status === "rejected") {
        expect(results[index].reason.code).toBe("permission-denied");
        entries.push(
          await saveAssumptionChanges(
            user,
            projectId,
            "score-note",
            targets[index],
            null,
          ),
        );
      }
    }
    const first = entries.find(
      (entry) => entry.scoreChange.from.criticality === 80,
    );
    const second = entries.find((entry) => entry.id !== first.id);
    expect(second.scoreChange.from).toEqual(first.scoreChange.to);
    const final = (await getDoc(doc(serviceDb, parent))).data();
    expect(final).toMatchObject(second.scoreChange.to);
    expect(final.lastScoreChangeId).toBe(second.id);
    expect(
      (await getDocs(collection(serviceDb, parent, "insights"))).size,
    ).toBe(2);
  });
  it("saves and clears management fields with immutable attributed from/to history", async () => {
    const first = await saveAssumptionChanges(
      user,
      projectId,
      "score-note",
      null,
      null,
      { nextStep: " Run a pilot ", helpNeeded: "Two customers" },
    );
    expect(first.managementChange).toEqual({
      from: { nextStep: "", helpNeeded: "" },
      to: { nextStep: "Run a pilot", helpNeeded: "Two customers" },
    });
    expect(first.scoreChange).toBeUndefined();
    let current = (await getDoc(doc(serviceDb, parent))).data();
    expect(current).toMatchObject({
      criticality: 80,
      evidence: 20,
      nextStep: "Run a pilot",
      helpNeeded: "Two customers",
      lastManagementChangeId: first.id,
    });
    const stored = (
      await getDoc(doc(serviceDb, parent, "insights", first.id))
    ).data();
    expect(stored.createdBy).toBe(ownerId);
    expect(stored.authorEmail).toBe(user.email);
    expect(stored.createdAt.isEqual(current.updatedAt)).toBe(true);
    const cleared = await saveAssumptionChanges(
      user,
      projectId,
      "score-note",
      null,
      null,
      { nextStep: "" },
    );
    expect(cleared.managementChange.from).toEqual(first.managementChange.to);
    expect(cleared.managementChange.to).toEqual({
      nextStep: "",
      helpNeeded: "Two customers",
    });
    current = (await getDoc(doc(serviceDb, parent))).data();
    expect(current.helpNeeded).toBe("Two customers");
    await assertFails(
      updateDoc(doc(serviceDb, parent, "insights", first.id), {
        managementChange: cleared.managementChange,
      }),
    );
    await assertFails(deleteDoc(doc(serviceDb, parent, "insights", first.id)));
  });
  it("saves scores, management fields and an insight in one record", async () => {
    const entry = await saveAssumptionChanges(
      user,
      projectId,
      "score-note",
      { criticality: 75, evidence: 60 },
      { description: "Pilot changed our judgment" },
      { nextStep: "Expand pilot" },
    );
    expect(entry.scoreChange).toBeDefined();
    expect(entry.managementChange).toBeDefined();
    expect(entry.description).toBe("Pilot changed our judgment");
    const current = (await getDoc(doc(serviceDb, parent))).data();
    expect(current).toMatchObject({
      criticality: 75,
      evidence: 60,
      nextStep: "Expand pilot",
      lastScoreChangeId: entry.id,
      lastManagementChangeId: entry.id,
    });
    expect(
      (await getDocs(collection(serviceDb, parent, "insights"))).size,
    ).toBe(1);
  });
  it("supports management-only edits on an unassessed assumption", async () => {
    const ref = doc(
      serviceDb,
      `projects/${projectId}/assumptions/unscored-management`,
    );
    await setDoc(ref, {
      statement: "We can deliver",
      createdBy: ownerId,
      createdAt: Timestamp.now(),
    });
    await saveAssumptionChanges(
      user,
      projectId,
      "unscored-management",
      null,
      null,
      { helpNeeded: "Technical review" },
    );
    const current = (await getDoc(ref)).data();
    expect(current.helpNeeded).toBe("Technical review");
    expect(current.criticality).toBeUndefined();
    expect(current.evidence).toBeUndefined();
  });
  it("rejects direct management edits, forged history, invalid values and nonmember edits", async () => {
    await assertFails(
      updateDoc(doc(serviceDb, parent), {
        nextStep: "Bypass",
        updatedBy: ownerId,
        updatedAt: serverTimestamp(),
      }),
    );
    const batch = writeBatch(serviceDb);
    batch.update(doc(serviceDb, parent), {
      nextStep: "New",
      helpNeeded: "",
      lastManagementChangeId: "fake",
      updatedBy: ownerId,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(serviceDb, parent, "insights", "fake"), {
      createdBy: ownerId,
      authorEmail: user.email,
      createdAt: serverTimestamp(),
      managementChange: {
        from: { nextStep: "Fabricated", helpNeeded: "" },
        to: { nextStep: "New", helpNeeded: "" },
      },
    });
    await assertFails(batch.commit());
    for (const fields of [
      { nextStep: 123 },
      { helpNeeded: "x".repeat(4001) },
      { unknown: "bad" },
    ]) {
      await expect(
        saveAssumptionChanges(
          user,
          projectId,
          "score-note",
          null,
          null,
          fields,
        ),
      ).rejects.toThrow();
    }
    await assertFails(
      updateDoc(doc(verifiedContext(otherUserId).firestore(), parent), {
        nextStep: "Not authorized",
        updatedBy: otherUserId,
        updatedAt: serverTimestamp(),
      }),
    );
    expect(
      (await getDocs(collection(serviceDb, parent, "insights"))).empty,
    ).toBe(true);
  });
  it("rejects invalid management data through rules and rolls back the whole save", async () => {
    const batch = writeBatch(serviceDb);
    batch.update(doc(serviceDb, parent), {
      nextStep: "x".repeat(4001),
      helpNeeded: "",
      lastManagementChangeId: "long",
      updatedAt: serverTimestamp(),
      updatedBy: ownerId,
    });
    batch.set(doc(serviceDb, parent, "insights", "long"), {
      createdAt: serverTimestamp(),
      createdBy: ownerId,
      authorEmail: user.email,
      managementChange: {
        from: { nextStep: "", helpNeeded: "" },
        to: { nextStep: "x".repeat(4001), helpNeeded: "" },
      },
    });
    await assertFails(batch.commit());
    await assertFails(
      saveAssumptionChanges(
        { ...user, email: "forged@example.com" },
        projectId,
        "score-note",
        { criticality: 70, evidence: 60 },
        { description: "Fail together" },
        { nextStep: "Do this" },
      ),
    );
    const current = (await getDoc(doc(serviceDb, parent))).data();
    expect(current).toMatchObject({ criticality: 80, evidence: 20 });
    expect(current.nextStep).toBeUndefined();
    expect(
      (await getDocs(collection(serviceDb, parent, "insights"))).empty,
    ).toBe(true);
  });
});

describe("formal review publication", () => {
  const email = "owner@example.org";
  const values = () => ({
    schemaVersion: 1,
    title: "First review",
    notes: "Baseline",
    previousReviewId: null,
    capturedAt: Date.now(),
    assumptions: [],
    promises: { customerPromise: "", investorPromise: "", coworkerPromise: "" },
    publishedBy: ownerId,
    publisherEmail: email,
    publishedAt: serverTimestamp(),
  });
  const ownerDb = () =>
    testEnv
      .authenticatedContext(ownerId, { email_verified: true, email })
      .firestore();
  it("preserves history, blocks new snapshots while off, and resumes after re-enabling", async () => {
    await seedPrivateProject();
    serviceDb = ownerDb();
    const { publishReview } =
      await import("../../src/features/reviews/reviewService.js");
    const { saveReviewPreference } =
      await import("../../src/features/reviews/reviewPreference.js");
    const user = { uid: ownerId, email };
    const captured = await captureReview(projectId);
    const payload = {
      ...captured.snapshot,
      title: "Saved",
      notes: "",
      previousReviewId: null,
    };
    await publishReview(user, projectId, "saved", payload);
    await saveReviewPreference(projectId, user, false);
    await assertSucceeds(
      getDoc(doc(serviceDb, "projects", projectId, "reviews", "saved")),
    );
    await assertFails(
      setDoc(
        doc(serviceDb, "projects", projectId, "reviews", "blocked"),
        values(),
      ),
    );
    await expect(captureReview(projectId)).rejects.toThrow("turned off");
    await expect(
      publishReview(user, projectId, "stale-draft", payload),
    ).rejects.toThrow("turned off");
    // A retry confirming a previously committed publication remains idempotent.
    await publishReview(user, projectId, "saved", payload);
    await setDoc(
      doc(serviceDb, "projects", projectId, "assumptions", "existing"),
      {
        statement: "We can deliver.",
        createdBy: ownerId,
        createdAt: serverTimestamp(),
      },
    );
    await assertSucceeds(
      addInsight(user, projectId, "existing", {
        description: "Learning continues",
      }),
    );
    await saveReviewPreference(projectId, user, true);
    await publishReview(user, projectId, "resumed", payload);
  });
  it("rejects publication batched with disabling reviews", async () => {
    await seedPrivateProject();
    const db = ownerDb();
    const batch = writeBatch(db);
    batch.update(doc(db, "projects", projectId), {
      formalReviewsEnabled: false,
      reviewPreferenceUpdatedBy: ownerId,
      reviewPreferenceUpdatedAt: serverTimestamp(),
    });
    batch.set(doc(db, "projects", projectId, "reviews", "r"), values());
    await assertFails(batch.commit());
  });
  it("allows a member to publish and read but never edit or delete a snapshot", async () => {
    await seedPrivateProject();
    const ref = doc(ownerDb(), "projects", projectId, "reviews", "r1");
    await assertSucceeds(setDoc(ref, values()));
    await assertSucceeds(getDoc(ref));
    await assertFails(updateDoc(ref, { notes: "Rewrite history" }));
    await assertFails(deleteDoc(ref));
  });
  it("blocks nonmembers, unverified users, inactive members, and anonymous access", async () => {
    await seedPrivateProject();
    await setDoc(
      doc(ownerDb(), "projects", projectId, "reviews", "r1"),
      values(),
    );
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(
          context.firestore(),
          "users",
          "inactive",
          "projectMemberships",
          projectId,
        ),
        { ...membership(projectId, "inactive"), active: false },
      );
    });
    const contexts = [
      verifiedContext(otherUserId),
      testEnv.authenticatedContext(ownerId, { email_verified: false, email }),
      testEnv.authenticatedContext("inactive", { email_verified: true, email }),
      testEnv.unauthenticatedContext(),
    ];
    for (const context of contexts) {
      const db = context.firestore();
      await assertFails(
        getDocs(collection(db, "projects", projectId, "reviews")),
      );
      await assertFails(
        getDoc(doc(db, "projects", projectId, "reviews", "r1")),
      );
      await assertFails(
        setDoc(doc(db, "projects", projectId, "reviews", "r2"), values()),
      );
    }
  });
  it("rejects forged attribution, client publication time, invalid envelopes, and outside baselines", async () => {
    await seedPrivateProject();
    const ref = doc(ownerDb(), "projects", projectId, "reviews", "r1");
    for (const patch of [
      { publishedBy: otherUserId },
      { publisherEmail: "fake@example.org" },
      { publishedAt: Timestamp.fromMillis(1) },
      { title: " " },
      { assumptions: "bad" },
      { extra: true },
      { previousReviewId: "foreign-review" },
    ]) {
      await assertFails(setDoc(ref, { ...values(), ...patch }));
    }
    await setDoc(ref, values());
    await assertSucceeds(
      setDoc(doc(ownerDb(), "projects", projectId, "reviews", "r2"), {
        ...values(),
        previousReviewId: "r1",
      }),
    );
  });
  it("publishes through the service and safely retries an acknowledged or uncertain commit", async () => {
    await seedPrivateProject();
    serviceDb = ownerDb();
    const { publishReview, loadReviews } =
      await import("../../src/features/reviews/reviewService.js");
    const payload = values();
    for (const field of [
      "schemaVersion",
      "publishedBy",
      "publisherEmail",
      "publishedAt",
    ])
      delete payload[field];
    const user = { uid: ownerId, email };
    await publishReview(user, projectId, "stable-id", payload);
    await publishReview(user, projectId, "stable-id", payload);
    const reviews = await loadReviews(projectId);
    await expect(
      publishReview(user, projectId, "stable-id", {
        ...payload,
        notes: "Changed after uncertain response",
      }),
    ).rejects.toThrow("already saved");
    expect(reviews).toHaveLength(1);
    expect(reviews[0].publishedAt.toMillis()).toBeGreaterThan(0);
  });
});

it("compares later saved work while preserving the first published portfolio", async () => {
  await seedPrivateProject();
  serviceDb = testEnv
    .authenticatedContext(ownerId, {
      email_verified: true,
      email: "owner@example.org",
    })
    .firestore();
  const user = { uid: ownerId, email: "owner@example.org" };
  const { captureReview, publishReview, loadReviews } =
    await import("../../src/features/reviews/reviewService.js");
  const { compareReview } =
    await import("../../src/features/reviews/reviewValues.js");
  const ref = doc(serviceDb, "projects", projectId, "assumptions", "a");
  await setDoc(ref, {
    statement: "Customers adopt",
    createdBy: ownerId,
    createdAt: serverTimestamp(),
    criticality: 90,
    evidence: 20,
  });
  const first = await captureReview(projectId);
  expect(first.previous).toBeNull();
  await publishReview(user, projectId, "baseline", {
    ...first.snapshot,
    title: "Baseline",
    notes: "Reviewed",
    previousReviewId: null,
  });
  await saveAssumptionChanges(
    user,
    projectId,
    "a",
    { criticality: 90, evidence: 60 },
    { description: "Pilot completed" },
    { nextStep: "Repeat pilot", helpNeeded: "Recruit participants" },
  );
  await addInsight(user, projectId, "a", {
    description: "Additional judgment without a score change",
  });
  const next = await captureReview(projectId);
  expect(next.previous.id).toBe("baseline");
  const changes = compareReview(next.snapshot, next.previous);
  expect(changes[0].changes).toContainEqual({
    key: "evidence",
    from: 20,
    to: 60,
  });
  expect(changes[0].newInsights).toHaveLength(2);
  const [baseline] = await loadReviews(projectId);
  expect(baseline.assumptions[0].evidence).toBe(20);
  expect(baseline.assumptions[0].insights).toHaveLength(0);
});

describe("project invitations and collaboration", () => {
  const ownerEmail = "owner@example.org";
  const recipientEmail = "collaborator@example.org";
  const recipientId = "collaborator";
  const user = { uid: recipientId, email: recipientEmail };
  const owner = { uid: ownerId, email: ownerEmail };
  const context = (uid, email, verified = true) =>
    testEnv.authenticatedContext(uid, { email, email_verified: verified });
  const ownerDb = () => context(ownerId, ownerEmail).firestore();
  const recipientDb = () => context(recipientId, recipientEmail).firestore();
  const invitation = (patch = {}) => ({
    projectId,
    recipientEmail,
    invitedBy: ownerId,
    inviterEmail: ownerEmail,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 86400000),
    status: "pending",
    ...patch,
  });
  async function setupInvite(id = "invite-1") {
    await seedPrivateProject();
    await setDoc(doc(ownerDb(), "projectInvitations", id), invitation());
    return id;
  }
  async function join(id = "invite-1") {
    serviceDb = recipientDb();
    const { acceptInvitation } =
      await import("../../src/features/members/memberService.js");
    return acceptInvitation(user, id);
  }

  it("allows only the owner to invite and list invitations", async () => {
    await seedPrivateProject();
    serviceDb = ownerDb();
    const { inviteMember, loadInvitations } =
      await import("../../src/features/members/memberService.js");
    const id = await inviteMember(
      owner,
      projectId,
      " Collaborator@Example.org ",
    );
    expect((await loadInvitations(projectId))[0].recipientEmail).toBe(
      recipientEmail,
    );
    const otherDb = context(otherUserId, "outsider@example.org").firestore();
    await assertFails(
      setDoc(
        doc(otherDb, "projectInvitations", "forged"),
        invitation({
          invitedBy: otherUserId,
          inviterEmail: "outsider@example.org",
        }),
      ),
    );
    await assertFails(getDocs(collection(otherDb, "projectInvitations")));
    await assertFails(getDoc(doc(otherDb, "projectInvitations", id)));
    await assertFails(
      getDoc(
        doc(
          testEnv.unauthenticatedContext().firestore(),
          "projectInvitations",
          id,
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          context(recipientId, recipientEmail, false).firestore(),
          "projectInvitations",
          id,
        ),
      ),
    );
  });

  it("keeps project content private until the intended verified recipient accepts", async () => {
    await setupInvite();
    const db = recipientDb();
    await assertSucceeds(getDoc(doc(db, "projectInvitations", "invite-1")));
    await assertFails(getDoc(doc(db, "projects", projectId)));
    await assertFails(
      getDocs(collection(db, "projects", projectId, "assumptions")),
    );
    expect(await join()).toBe(projectId);
    await assertSucceeds(getDoc(doc(db, "projects", projectId)));
    await assertSucceeds(
      setDoc(doc(db, "projects", projectId, "assumptions", "shared"), {
        statement: "We can deliver",
        createdBy: recipientId,
        createdAt: serverTimestamp(),
      }),
    );
    serviceDb = db;
    await saveAssumptionChanges(
      user,
      projectId,
      "shared",
      { criticality: 80, evidence: 30 },
      { description: "Member judgment" },
    );
    const { captureReview, publishReview } =
      await import("../../src/features/reviews/reviewService.js");
    const review = await captureReview(projectId);
    await publishReview(user, projectId, "member-review", {
      ...review.snapshot,
      title: "Team review",
      notes: "Shared",
      previousReviewId: null,
    });
    await assertSucceeds(
      getDoc(doc(ownerDb(), "projects", projectId, "reviews", "member-review")),
    );
    await seedPrivateProject("unrelated", otherUserId);
    await assertFails(getDoc(doc(db, "projects", "unrelated")));
    await assertFails(
      setDoc(doc(db, "projects", "unrelated", "assumptions", "injected"), {
        statement: "No",
        createdBy: recipientId,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("normalizes the verified token's email case and supports repeat acceptance", async () => {
    await setupInvite();
    serviceDb = context(recipientId, "Collaborator@Example.org").firestore();
    const { acceptInvitation } =
      await import("../../src/features/members/memberService.js");
    expect(
      await acceptInvitation(
        { uid: recipientId, email: "Collaborator@Example.org" },
        "invite-1",
      ),
    ).toBe(projectId);
    expect(await join()).toBe(projectId);
    const record = await adminDocument("projectInvitations/invite-1");
    expect(record.data().acceptedBy).toBe(recipientId);
    expect(record.data().acceptedAt.toMillis()).toBeGreaterThan(0);
  });

  it("rejects self-granted membership, partial acceptance, wrong recipients, and ownership escalation", async () => {
    await setupInvite();
    const db = recipientDb();
    const member = {
      projectId,
      userId: recipientId,
      role: "member",
      active: true,
      createdAt: serverTimestamp(),
      invitationId: "invite-1",
      email: recipientEmail,
    };
    await assertFails(
      setDoc(
        doc(db, "users", recipientId, "projectMemberships", projectId),
        member,
      ),
    );
    await assertFails(
      updateDoc(doc(db, "projectInvitations", "invite-1"), {
        status: "accepted",
        acceptedBy: recipientId,
        acceptedAt: serverTimestamp(),
      }),
    );
    const batch = writeBatch(db);
    batch.set(doc(db, "users", recipientId, "projectMemberships", projectId), {
      ...member,
      role: "owner",
    });
    batch.set(doc(db, "projects", projectId, "members", recipientId), {
      ...member,
      role: "owner",
    });
    batch.update(doc(db, "projectInvitations", "invite-1"), {
      status: "accepted",
      acceptedBy: recipientId,
      acceptedAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
    const wrongDb = context("wrong", "wrong@example.org").firestore();
    await assertFails(
      updateDoc(doc(wrongDb, "projectInvitations", "invite-1"), {
        status: "accepted",
        acceptedBy: "wrong",
        acceptedAt: serverTimestamp(),
      }),
    );
    expect(
      (
        await adminDocument(
          `users/${recipientId}/projectMemberships/${projectId}`,
        )
      ).exists(),
    ).toBe(false);
  });

  it("rejects expired and revoked invitations and preserves terminal state", async () => {
    await setupInvite();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "projectInvitations", "invite-1"), {
        expiresAt: Timestamp.fromMillis(1),
      });
    });
    await expect(join()).rejects.toBeDefined();
    await setDoc(
      doc(ownerDb(), "projectInvitations", "revocable"),
      invitation(),
    );
    serviceDb = ownerDb();
    const { revokeInvitation } =
      await import("../../src/features/members/memberService.js");
    await revokeInvitation("revocable");
    await expect(join("revocable")).rejects.toThrow("no longer pending");
    await assertFails(
      updateDoc(doc(ownerDb(), "projectInvitations", "revocable"), {
        status: "pending",
      }),
    );
    await assertFails(
      deleteDoc(doc(ownerDb(), "projectInvitations", "revocable")),
    );
  });

  it("removes membership atomically, denies further access, preserves history, and permits a fresh invitation", async () => {
    await setupInvite();
    await join();
    serviceDb = recipientDb();
    await setDoc(doc(serviceDb, "projects", projectId, "assumptions", "a"), {
      statement: "Member work",
      createdBy: recipientId,
      createdAt: serverTimestamp(),
    });
    await addInsight(user, projectId, "a", {
      description: "Keep this attribution",
    });
    serviceDb = ownerDb();
    const { removeMember, loadMembers, inviteMember } =
      await import("../../src/features/members/memberService.js");
    expect((await loadMembers(projectId))[0].email).toBe(recipientEmail);
    const outstanding = await inviteMember(owner, projectId, recipientEmail);
    await removeMember(owner, projectId, recipientId);
    expect((await loadMembers(projectId))[0].active).toBe(false);
    await expect(join(outstanding)).rejects.toThrow(
      "removed after this invitation",
    );
    const staleDb = recipientDb();
    const staleBatch = writeBatch(staleDb);
    const staleData = {
      projectId,
      userId: recipientId,
      role: "member",
      active: true,
      createdAt: serverTimestamp(),
      invitationId: outstanding,
      email: recipientEmail,
    };
    staleBatch.set(
      doc(staleDb, "users", recipientId, "projectMemberships", projectId),
      staleData,
    );
    staleBatch.set(
      doc(staleDb, "projects", projectId, "members", recipientId),
      staleData,
    );
    staleBatch.update(doc(staleDb, "projectInvitations", outstanding), {
      status: "accepted",
      acceptedBy: recipientId,
      acceptedAt: serverTimestamp(),
    });
    await assertFails(staleBatch.commit());
    const db = recipientDb();
    for (const path of [
      `projects/${projectId}`,
      `projects/${projectId}/assumptions/a`,
    ])
      await assertFails(getDoc(doc(db, path)));
    await assertFails(
      getDocs(collection(db, "projects", projectId, "reviews")),
    );
    await assertFails(
      getDocs(
        collection(db, "projects", projectId, "assumptions", "a", "insights"),
      ),
    );
    await assertFails(
      updateDoc(doc(db, "projects", projectId, "assumptions", "a"), {
        statement: "After removal",
        updatedBy: recipientId,
        updatedAt: serverTimestamp(),
      }),
    );
    await expect(join()).rejects.toThrow("no longer pending");
    serviceDb = ownerDb();
    expect(
      (
        await getDocs(
          collection(serviceDb, "projects", projectId, "memberRemovals"),
        )
      ).size,
    ).toBe(1);
    expect(
      (
        await getDocs(
          collection(
            serviceDb,
            "projects",
            projectId,
            "assumptions",
            "a",
            "insights",
          ),
        )
      ).docs[0].data().createdBy,
    ).toBe(recipientId);
    const fresh = await inviteMember(owner, projectId, recipientEmail);
    await join(fresh);
    await assertSucceeds(getDoc(doc(recipientDb(), "projects", projectId)));
    expect(
      (
        await getDocs(
          collection(ownerDb(), "projects", projectId, "memberRemovals"),
        )
      ).size,
    ).toBe(1);
  });

  it("forbids member administration and owner removal, and requires matching removal records", async () => {
    await setupInvite();
    await join();
    const db = recipientDb();
    await assertFails(
      getDocs(collection(db, "projects", projectId, "members")),
    );
    await assertFails(
      setDoc(
        doc(db, "projectInvitations", "member-invite"),
        invitation({ invitedBy: recipientId, inviterEmail: recipientEmail }),
      ),
    );
    await assertFails(
      updateDoc(
        doc(db, "users", recipientId, "projectMemberships", projectId),
        { role: "owner" },
      ),
    );
    await assertFails(
      updateDoc(
        doc(ownerDb(), "users", ownerId, "projectMemberships", projectId),
        { active: false },
      ),
    );
    await assertFails(
      updateDoc(
        doc(ownerDb(), "users", recipientId, "projectMemberships", projectId),
        { active: false },
      ),
    );
    await assertFails(
      updateDoc(doc(ownerDb(), "projectInvitations", "invite-1"), {
        recipientEmail: "changed@example.org",
      }),
    );
  });

  it("rejects forged creation metadata, overlong expiration, and unexpected fields", async () => {
    await seedPrivateProject();
    const ref = doc(ownerDb(), "projectInvitations", "bad");
    for (const patch of [
      { invitedBy: otherUserId },
      { inviterEmail: "forged@example.org" },
      { recipientEmail: "UPPER@example.org" },
      { recipientEmail: "not-email" },
      { createdAt: Timestamp.fromMillis(1) },
      { expiresAt: Timestamp.fromMillis(Date.now() + 10 * 86400000) },
      { status: "accepted" },
      { projectName: "Leaked metadata" },
    ]) {
      await assertFails(setDoc(ref, invitation(patch)));
    }
  });
});

describe("Candidate capture and adoption", () => {
  const actor = { uid: ownerId, email: "owner@example.com" };
  beforeEach(async () => {
    await seedPrivateProject();
    serviceDb = testEnv
      .authenticatedContext(ownerId, {
        email_verified: true,
        email: actor.email,
      })
      .firestore();
  });
  const candidateRef = (id) =>
    doc(serviceDb, "projects", projectId, "candidates", id);
  const activeRef = (id) =>
    doc(serviceDb, "projects", projectId, "assumptions", id);

  it("bulk saves candidates separately, edits, adopts with initial scores, and preserves immutable origin", async () => {
    const added = await addCandidates(
      actor,
      projectId,
      "Customers will pay.\n\n We can deliver. ",
    );
    expect(await loadCandidates(projectId)).toHaveLength(2);
    expect(await loadAssumptions(projectId)).toHaveLength(0);
    await editCandidate(
      actor,
      projectId,
      added[0].id,
      "Customers will pay enough.",
    );
    const active = await adoptCandidate(
      actor,
      projectId,
      added[0].id,
      "Customers will pay enough.",
    );
    expect(active.sourceCandidateId).toBe(added[0].id);
    expect(active.criticality).toBe(0);
    await adoptCandidate(
      actor,
      projectId,
      added[0].id,
      "Customers will pay enough.",
    );
    expect(await loadAssumptions(projectId)).toHaveLength(1);
    const saved = (await getDoc(candidateRef(added[0].id))).data();
    expect(saved.createdBy).toBe(ownerId);
    expect(saved.adoptedBy).toBe(ownerId);
    expect(saved.createdAt).toBeInstanceOf(Timestamp);
    expect(saved.adoptedAt).toBeInstanceOf(Timestamp);
    await assertFails(
      editCandidate(actor, projectId, added[0].id, "Rewrite history"),
    );
    await assertFails(deleteDoc(candidateRef(added[0].id)));
    await assertFails(
      updateDoc(activeRef(added[0].id), {
        sourceCandidateId: "different",
        updatedBy: ownerId,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateAssumption(
        actor,
        projectId,
        added[0].id,
        "Refined active statement.",
      ),
    );
    await assertSucceeds(
      updateAssumptionScores(actor, projectId, added[0].id, {
        criticality: 80,
        evidence: 20,
      }),
    );
  });

  it("requires both sides of adoption and rejects forged or cross-project origin", async () => {
    const [candidate] = await addCandidates(
      actor,
      projectId,
      "We can deliver.",
    );
    await assertFails(
      updateDoc(candidateRef(candidate.id), {
        status: "adopted",
        adoptedBy: ownerId,
        adoptedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(activeRef(candidate.id), {
        statement: candidate.statement,
        sourceCandidateId: candidate.id,
        createdBy: ownerId,
        createdAt: serverTimestamp(),
      }),
    );
    const batch = writeBatch(serviceDb);
    batch.update(candidateRef(candidate.id), {
      status: "adopted",
      adoptedBy: ownerId,
      adoptedAt: serverTimestamp(),
    });
    batch.set(activeRef(candidate.id), {
      statement: "Different wording",
      sourceCandidateId: candidate.id,
      createdBy: ownerId,
      createdAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
    expect((await getDoc(candidateRef(candidate.id))).data().status).toBe(
      "pending",
    );
    expect((await getDoc(activeRef(candidate.id))).exists()).toBe(false);
    await seedPrivateProject("project-b", ownerId);
    await assertFails(
      setDoc(
        doc(serviceDb, "projects", "project-b", "assumptions", candidate.id),
        {
          statement: candidate.statement,
          sourceCandidateId: candidate.id,
          createdBy: ownerId,
          createdAt: serverTimestamp(),
        },
      ),
    );
  });

  it("rejects stale adoption and serializes concurrent adoption to one active record", async () => {
    const [candidate] = await addCandidates(
      actor,
      projectId,
      "Original wording",
    );
    await editCandidate(actor, projectId, candidate.id, "Reviewed wording");
    await expect(
      adoptCandidate(actor, projectId, candidate.id, candidate.statement),
    ).rejects.toThrow(/edited by someone else/);
    await Promise.all([
      adoptCandidate(actor, projectId, candidate.id, "Reviewed wording"),
      adoptCandidate(actor, projectId, candidate.id, "Reviewed wording"),
    ]);
    expect(await loadAssumptions(projectId)).toHaveLength(1);
  });

  it("allows another active member to adopt and denies outsiders, unverified and removed members", async () => {
    const [candidate] = await addCandidates(
      actor,
      projectId,
      "We can deliver.",
    );
    for (const context of [
      testEnv.unauthenticatedContext(),
      testEnv.authenticatedContext(otherUserId, { email_verified: true }),
      testEnv.authenticatedContext(ownerId, { email_verified: false }),
    ]) {
      const ref = doc(
        context.firestore(),
        "projects",
        projectId,
        "candidates",
        candidate.id,
      );
      await assertFails(getDoc(ref));
      await assertFails(
        getDocs(
          collection(context.firestore(), "projects", projectId, "candidates"),
        ),
      );
      await assertFails(
        updateDoc(ref, {
          statement: "Intrusion",
          updatedBy: otherUserId,
          updatedAt: serverTimestamp(),
        }),
      );
    }
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(
          context.firestore(),
          "users",
          otherUserId,
          "projectMemberships",
          projectId,
        ),
        membership(projectId, otherUserId, "member"),
      );
    });
    serviceDb = testEnv
      .authenticatedContext(otherUserId, {
        email_verified: true,
        email: "member@example.com",
      })
      .firestore();
    await assertSucceeds(
      adoptCandidate(
        { uid: otherUserId, email: "member@example.com" },
        projectId,
        candidate.id,
        candidate.statement,
      ),
    );
    expect((await getDoc(candidateRef(candidate.id))).data().createdBy).toBe(
      ownerId,
    );
    expect((await getDoc(candidateRef(candidate.id))).data().adoptedBy).toBe(
      otherUserId,
    );
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(
        doc(
          context.firestore(),
          "users",
          otherUserId,
          "projectMemberships",
          projectId,
        ),
        { active: false },
      );
    });
    await assertFails(loadCandidates(projectId));
    await assertFails(
      addCandidates(
        { uid: otherUserId, email: "member@example.com" },
        projectId,
        "Another candidate",
      ),
    );
  });

  it("keeps pending candidates out of reviews and retains existing active assumptions", async () => {
    await setDoc(activeRef("existing"), {
      statement: "Existing active assumption",
      createdBy: ownerId,
      createdAt: serverTimestamp(),
      criticality: 90,
      evidence: 25,
    });
    const [candidate] = await addCandidates(actor, projectId, "New candidate");
    const before = await captureReview(projectId);
    expect(before.snapshot.assumptions.map((item) => item.id)).toEqual([
      "existing",
    ]);
    await adoptCandidate(actor, projectId, candidate.id, candidate.statement);
    const after = await captureReview(projectId);
    expect(after.snapshot.assumptions).toHaveLength(2);
    expect(
      after.snapshot.assumptions.find((item) => item.id === "existing")
        .criticality,
    ).toBe(90);
    expect(
      after.snapshot.assumptions.find((item) => item.id === candidate.id)
        .criticality,
    ).toBe(0);
    expect(before.snapshot.assumptions).toHaveLength(1);
  });

  it("validates creation metadata and supports the 20-candidate batch limit", async () => {
    for (const patch of [
      { statement: " " },
      { statement: "a".repeat(2001) },
      { createdBy: otherUserId },
      { authorEmail: "fake@example.com" },
      { createdAt: Timestamp.fromMillis(1) },
      { status: "adopted" },
      { criticality: 99 },
    ]) {
      await assertFails(
        setDoc(candidateRef("invalid"), {
          statement: "Valid statement",
          status: "pending",
          createdBy: ownerId,
          authorEmail: actor.email,
          createdAt: serverTimestamp(),
          ...patch,
        }),
      );
    }
    await assertSucceeds(
      addCandidates(
        actor,
        projectId,
        Array.from({ length: 20 }, (_, i) => `Candidate ${i}`).join("\n"),
      ),
    );
    expect(await loadCandidates(projectId)).toHaveLength(20);
  });
});

describe("Unified assumption drawer saves", () => {
  const user = { uid: ownerId, email: "owner@example.com" };
  const initial = {
    statement: "Customers will adopt it.",
    criticality: 80,
    evidence: 20,
    nextStep: "",
    helpNeeded: "",
  };
  const parent = `projects/${projectId}/assumptions/drawer`;
  beforeEach(async () => {
    await seedPrivateProject();
    serviceDb = testEnv
      .authenticatedContext(ownerId, {
        email_verified: true,
        email: user.email,
      })
      .firestore();
    await setDoc(doc(serviceDb, parent), {
      statement: initial.statement,
      criticality: 80,
      evidence: 20,
      createdBy: ownerId,
      createdAt: Timestamp.now(),
    });
  });
  it("atomically saves wording, scores, management and an attributed insight", async () => {
    const next = {
      ...initial,
      statement: "Customers will pay for it.",
      evidence: 65,
      nextStep: "Run a pilot",
      helpNeeded: "Two customers",
    };
    const result = await saveAssumptionDraft(
      user,
      projectId,
      "drawer",
      initial,
      next,
      { description: "Pilot interviews" },
    );
    expect((await getDoc(doc(serviceDb, parent))).data()).toMatchObject(next);
    expect(result.assumption).toMatchObject(next);
    const records = await getDocs(collection(serviceDb, parent, "insights"));
    expect(records.size).toBe(1);
    expect(records.docs[0].data()).toMatchObject({
      description: "Pilot interviews",
      createdBy: ownerId,
      authorEmail: user.email,
      scoreChange: {
        from: { criticality: 80, evidence: 20 },
        to: { criticality: 80, evidence: 65 },
      },
      managementChange: {
        from: { nextStep: "", helpNeeded: "" },
        to: { nextStep: "Run a pilot", helpNeeded: "Two customers" },
      },
    });
  });
  it("rejects a stale edit without saving wording or an insight", async () => {
    await updateAssumptionScores(user, projectId, "drawer", {
      criticality: 80,
      evidence: 45,
    });
    await expect(
      saveAssumptionDraft(
        user,
        projectId,
        "drawer",
        initial,
        { ...initial, statement: "Changed wording", evidence: 60 },
        { description: "Stale note" },
      ),
    ).rejects.toMatchObject({
      code: "assumption-conflict",
      fields: ["evidence"],
    });
    expect((await getDoc(doc(serviceDb, parent))).data()).toMatchObject({
      statement: initial.statement,
      evidence: 45,
    });
    expect(
      (await getDocs(collection(serviceDb, parent, "insights"))).size,
    ).toBe(1);
  });
  it("allows only one competing update from the same baseline", async () => {
    const results = await Promise.allSettled([
      saveAssumptionDraft(
        user,
        projectId,
        "drawer",
        initial,
        { ...initial, evidence: 50 },
        { description: "First editor" },
      ),
      saveAssumptionDraft(
        user,
        projectId,
        "drawer",
        initial,
        { ...initial, evidence: 70 },
        { description: "Second editor" },
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected").reason.code,
    ).toBe("assumption-conflict");
    expect(
      (await getDocs(collection(serviceDb, parent, "insights"))).size,
    ).toBe(1);
  });
  it("checks latest wording even for an insight-only save", async () => {
    await updateAssumption(user, projectId, "drawer", "A revised assumption.");
    await expect(
      saveAssumptionDraft(user, projectId, "drawer", initial, initial, {
        description: "Learning",
      }),
    ).rejects.toMatchObject({
      code: "assumption-conflict",
      fields: ["statement"],
    });
    expect(
      (await getDocs(collection(serviceDb, parent, "insights"))).size,
    ).toBe(1);
  });
  it("preserves concurrent changes to untouched fields and creates no no-op history", async () => {
    await saveAssumptionChanges(user, projectId, "drawer", null, null, {
      helpNeeded: "Remote help",
    });
    const result = await saveAssumptionDraft(
      user,
      projectId,
      "drawer",
      initial,
      { ...initial, nextStep: "My next step" },
      {},
    );
    expect(result.assumption).toMatchObject({
      nextStep: "My next step",
      helpNeeded: "Remote help",
    });
    const count = (await getDocs(collection(serviceDb, parent, "insights")))
      .size;
    await saveAssumptionDraft(
      user,
      projectId,
      "drawer",
      result.assumption,
      result.assumption,
      {},
    );
    expect(
      (await getDocs(collection(serviceDb, parent, "insights"))).size,
    ).toBe(count);
  });
  it("creates all initial fields and history in one transaction, including zero scores", async () => {
    const next = {
      ...initial,
      criticality: 0,
      evidence: 0,
      nextStep: "Initial plan",
      helpNeeded: "Funding",
    };
    const result = await saveAssumptionDraft(
      user,
      projectId,
      "new-drawer",
      null,
      next,
      { description: "Initial insight" },
    );
    const created = `projects/${projectId}/assumptions/new-drawer`;
    expect((await getDoc(doc(serviceDb, created))).data()).toMatchObject(next);
    expect(result.insight.scoreChange.from).toEqual({
      criticality: null,
      evidence: null,
    });
    expect(
      (await getDocs(collection(serviceDb, created, "insights"))).size,
    ).toBe(1);
    await expect(
      saveAssumptionDraft(user, projectId, "new-drawer", null, next, {}),
    ).rejects.toMatchObject({ code: "assumption-conflict" });
  });
  it("creates an unscored assumption and permits insight-only creation", async () => {
    const result = await saveAssumptionDraft(
      user,
      projectId,
      "unscored-drawer",
      null,
      { statement: "We can support it." },
      { description: "We should investigate" },
    );
    expect(result.assumption).not.toHaveProperty("criticality");
    expect(
      (
        await getDocs(
          collection(
            serviceDb,
            `projects/${projectId}/assumptions/unscored-drawer/insights`,
          ),
        )
      ).size,
    ).toBe(1);
  });
  it("rejects invalid input and outsider writes without partially creating anything", async () => {
    await expect(
      saveAssumptionDraft(
        user,
        projectId,
        "invalid-drawer",
        null,
        { ...initial, evidence: null },
        {},
      ),
    ).rejects.toThrow(/both scores/);
    expect(
      (
        await getDoc(
          doc(serviceDb, `projects/${projectId}/assumptions/invalid-drawer`),
        )
      ).exists(),
    ).toBe(false);
    serviceDb = testEnv
      .authenticatedContext(otherUserId, {
        email_verified: true,
        email: "other@example.com",
      })
      .firestore();
    await assertFails(
      saveAssumptionDraft(
        { uid: otherUserId, email: "other@example.com" },
        projectId,
        "forbidden",
        null,
        initial,
        { description: "Forbidden" },
      ),
    );
    expect(
      (
        await adminDocument(`projects/${projectId}/assumptions/forbidden`)
      ).exists(),
    ).toBe(false);
  });
  it("denies initial management without matching history and denies forged initial history", async () => {
    await assertFails(
      setDoc(doc(serviceDb, `projects/${projectId}/assumptions/no-history`), {
        statement: "Test",
        createdBy: ownerId,
        createdAt: serverTimestamp(),
        nextStep: "Unrecorded",
      }),
    );
    const ref = doc(serviceDb, `projects/${projectId}/assumptions/forged`);
    const batch = writeBatch(serviceDb);
    batch.set(ref, {
      statement: "Test",
      createdBy: ownerId,
      createdAt: serverTimestamp(),
      criticality: 80,
      evidence: 20,
      updatedBy: ownerId,
      updatedAt: serverTimestamp(),
      lastScoreChangeId: "fake",
    });
    batch.set(doc(ref, "insights", "fake"), {
      createdBy: ownerId,
      authorEmail: user.email,
      createdAt: serverTimestamp(),
      scoreChange: {
        from: { criticality: 1, evidence: 1 },
        to: { criticality: 80, evidence: 20 },
      },
    });
    await assertFails(batch.commit());
    expect((await getDoc(ref)).exists()).toBe(false);
  });
});

describe("project review preference", () => {
  it("restricts updates to the active owner and preserves immutable project fields", async () => {
    await seedPrivateProject();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(
          context.firestore(),
          "users",
          otherUserId,
          "projectMemberships",
          projectId,
        ),
        membership(projectId, otherUserId, "member"),
      );
    });
    const patch = {
      formalReviewsEnabled: false,
      reviewPreferenceUpdatedBy: ownerId,
      reviewPreferenceUpdatedAt: serverTimestamp(),
    };
    const ref = doc(
      verifiedContext(ownerId).firestore(),
      "projects",
      projectId,
    );
    await assertSucceeds(updateDoc(ref, patch));
    for (const invalid of [
      { formalReviewsEnabled: "false" },
      { reviewPreferenceUpdatedBy: otherUserId },
      { reviewPreferenceUpdatedAt: Timestamp.now() },
      { creatorId: otherUserId },
      { name: "Renamed" },
      { extra: true },
    ])
      await assertFails(updateDoc(ref, { ...patch, ...invalid }));
    await assertFails(
      updateDoc(
        doc(verifiedContext(otherUserId).firestore(), "projects", projectId),
        { ...patch, reviewPreferenceUpdatedBy: otherUserId },
      ),
    );
    await assertFails(
      updateDoc(
        doc(
          testEnv.unauthenticatedContext().firestore(),
          "projects",
          projectId,
        ),
        patch,
      ),
    );
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(
        doc(
          context.firestore(),
          "users",
          ownerId,
          "projectMemberships",
          projectId,
        ),
        { active: false },
      );
    });
    await assertFails(updateDoc(ref, patch));
  });
  it("creates projects with explicit review choices and defaults new projects off", async () => {
    serviceDb = verifiedContext(ownerId).firestore();
    const { createProject } = await import("../../src/services.js");
    for (const choice of [undefined, false, true]) {
      const id = await createProject(
        { uid: ownerId },
        { name: "New project", formalReviewsEnabled: choice },
      );
      expect(
        (await getDoc(doc(serviceDb, "projects", id))).data()
          .formalReviewsEnabled,
      ).toBe(choice === true);
    }
  });
});

it("keeps reviews off through the live subscription and reopening the project", async () => {
  await seedPrivateProject();
  serviceDb = verifiedContext(ownerId).firestore();
  const { watchReviewPreference, saveReviewPreference } =
    await import("../../src/features/reviews/reviewPreference.js");
  let stop = () => {};
  let reopenedStop = () => {};
  try {
    let receiveOff;
    const off = new Promise((resolve) => {
      receiveOff = resolve;
    });
    stop = watchReviewPreference(
      projectId,
      (enabled) => {
        if (!enabled) receiveOff();
      },
      (error) => {
        throw error;
      },
    );
    await saveReviewPreference(projectId, { uid: ownerId }, false);
    await off;
    expect(
      (await getDoc(doc(serviceDb, "projects", projectId))).data()
        .formalReviewsEnabled,
    ).toBe(false);
    stop();
    const reopened = await new Promise((resolve, reject) => {
      reopenedStop = watchReviewPreference(projectId, resolve, reject);
    });
    expect(reopened).toBe(false);
  } finally {
    stop();
    reopenedStop();
  }
});

describe("scored candidate adoption", () => {
  const actor = { uid: ownerId, email: "owner@example.com" };
  beforeEach(async () => {
    await seedPrivateProject();
    serviceDb = testEnv
      .authenticatedContext(ownerId, {
        email_verified: true,
        email: actor.email,
      })
      .firestore();
  });
  const refs = (id) => ({
    candidate: doc(serviceDb, "projects", projectId, "candidates", id),
    active: doc(serviceDb, "projects", projectId, "assumptions", id),
    history: collection(
      serviceDb,
      "projects",
      projectId,
      "assumptions",
      id,
      "insights",
    ),
  });
  it("requires two deliberate scores and saves initial history, management, and insight atomically", async () => {
    const [candidate] = await addCandidates(
      actor,
      projectId,
      "We can deliver.",
    );
    const ref = refs(candidate.id);
    for (const scores of [
      undefined,
      {},
      { criticality: 0 },
      { criticality: 0, evidence: null },
      { criticality: 101, evidence: 20 },
      { criticality: 1.5, evidence: 20 },
    ]) {
      await expect(
        adoptCandidateWithScores(
          actor,
          projectId,
          candidate.id,
          candidate.statement,
          scores,
        ),
      ).rejects.toThrow();
      expect((await getDoc(ref.active)).exists()).toBe(false);
      expect((await getDoc(ref.candidate)).data().status).toBe("pending");
    }
    const draft = {
      criticality: 0,
      evidence: 100,
      nextStep: "Test delivery",
      helpNeeded: "Operations support",
    };
    const insight = {
      description: "Initial supporting evidence",
      sourceUrl: "https://example.com/evidence",
    };
    const active = await adoptCandidateWithScores(
      actor,
      projectId,
      candidate.id,
      candidate.statement,
      draft,
      insight,
      "request-1",
    );
    expect(active).toMatchObject({ ...draft, sourceCandidateId: candidate.id });
    const history = (await getDocs(ref.history)).docs;
    expect(history).toHaveLength(1);
    expect(history[0].data()).toMatchObject({
      ...insight,
      createdBy: actor.uid,
      authorEmail: actor.email,
      scoreChange: {
        from: { criticality: null, evidence: null },
        to: { criticality: 0, evidence: 100 },
      },
      managementChange: {
        from: { nextStep: "", helpNeeded: "" },
        to: { nextStep: draft.nextStep, helpNeeded: draft.helpNeeded },
      },
    });
    expect(history[0].data().createdAt).toBeInstanceOf(Timestamp);
    expect((await getDoc(ref.candidate)).data().adoptionInsightId).toBe(
      "request-1",
    );
    // A lost acknowledgement retry confirms the existing commit without another event.
    await adoptCandidateWithScores(
      actor,
      projectId,
      candidate.id,
      candidate.statement,
      draft,
      insight,
      "request-1",
    );
    expect((await getDocs(ref.history)).size).toBe(1);
    await expect(
      adoptCandidateWithScores(
        actor,
        projectId,
        candidate.id,
        candidate.statement,
        { ...draft, criticality: 50 },
        insight,
        "request-1",
      ),
    ).rejects.toThrow(/already been adopted/);
  });
  it("rejects direct unscored adoption, missing history, and forged attribution without partial writes", async () => {
    const [candidate] = await addCandidates(
      actor,
      projectId,
      "We can deliver.",
    );
    const ref = refs(candidate.id);
    for (const scores of [
      {},
      { criticality: 60, evidence: 40, lastScoreChangeId: "missing" },
    ]) {
      const batch = writeBatch(serviceDb);
      batch.update(ref.candidate, {
        status: "adopted",
        adoptedBy: actor.uid,
        adoptedAt: serverTimestamp(),
        adoptionInsightId: "missing",
      });
      batch.set(ref.active, {
        statement: candidate.statement,
        sourceCandidateId: candidate.id,
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        ...scores,
      });
      await assertFails(batch.commit());
    }
    await assertFails(
      adoptCandidateWithScores(
        { ...actor, email: "forged@example.com" },
        projectId,
        candidate.id,
        candidate.statement,
        { criticality: 60, evidence: 40 },
      ),
    );
    expect((await getDoc(ref.candidate)).data().status).toBe("pending");
    expect((await getDoc(ref.active)).exists()).toBe(false);
    expect((await getDocs(ref.history)).empty).toBe(true);
  });
  it("lets only one competing adoption win without silently accepting the losing scores", async () => {
    const [candidate] = await addCandidates(
      actor,
      projectId,
      "We can deliver.",
    );
    const outcomes = await Promise.allSettled([
      adoptCandidateWithScores(
        actor,
        projectId,
        candidate.id,
        candidate.statement,
        { criticality: 80, evidence: 20 },
        null,
        "request-a",
      ),
      adoptCandidateWithScores(
        actor,
        projectId,
        candidate.id,
        candidate.statement,
        { criticality: 10, evidence: 90 },
        null,
        "request-b",
      ),
    ]);
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(
      outcomes.find((item) => item.status === "rejected").reason.code,
    ).toBe("candidate-adopted");
    const ref = refs(candidate.id);
    expect((await getDocs(ref.history)).size).toBe(1);
    const winner = outcomes.find((item) => item.status === "fulfilled").value;
    expect((await getDoc(ref.active)).data()).toMatchObject({
      criticality: winner.criticality,
      evidence: winner.evidence,
    });
  });
});

it("keeps authentication email jobs and quota counters inaccessible to all browser clients", async () => {
  await seedPrivateProject();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "authEmailJobs", "private"), {
      email: "private@example.com",
      status: "pending",
    });
    await setDoc(doc(context.firestore(), "authEmailLimits", "private"), {
      count: 1,
    });
  });
  for (const context of [
    testEnv.unauthenticatedContext(),
    verifiedContext(ownerId),
    testEnv.authenticatedContext(ownerId, { email_verified: false }),
  ]) {
    for (const name of ["authEmailJobs", "authEmailLimits"]) {
      const ref = doc(context.firestore(), name, "private");
      await assertFails(getDoc(ref));
      await assertFails(getDocs(collection(context.firestore(), name)));
      await assertFails(setDoc(ref, { email: "forged@example.com" }));
      await assertFails(deleteDoc(ref));
    }
  }
});

describe("Immutable wording and promise history", () => {
  const actor = { uid: ownerId, email: "owner@example.com" };
  const briefPath = `projects/${projectId}/projectBrief/overview`;
  const assumptionPath = `projects/${projectId}/assumptions/wording`;
  const values = {
    customerPromise: "Value",
    investorPromise: "Return",
    coworkerPromise: "Culture",
  };
  beforeEach(async () => {
    await seedPrivateProject();
    serviceDb = testEnv
      .authenticatedContext(ownerId, {
        email_verified: true,
        email: actor.email,
      })
      .firestore();
    await setDoc(doc(serviceDb, assumptionPath), {
      statement: "Original statement",
      createdBy: ownerId,
      createdAt: Timestamp.now(),
    });
  });
  it("appends exact consecutive wording changes and does not record a no-op", async () => {
    let baseline = (await getDoc(doc(serviceDb, assumptionPath))).data();
    for (const statement of ["Second statement", "Third statement"]) {
      const result = await saveAssumptionDraft(
        actor,
        projectId,
        "wording",
        baseline,
        { ...baseline, statement },
        {},
      );
      expect(result.insight.wordingChange).toEqual({
        from: baseline.statement,
        to: statement,
      });
      baseline = result.assumption;
    }
    await saveAssumptionDraft(
      actor,
      projectId,
      "wording",
      baseline,
      { ...baseline, statement: " Third statement " },
      {},
    );
    const records = await getDocs(
      collection(serviceDb, assumptionPath, "insights"),
    );
    expect(records.size).toBe(2);
    await assertFails(
      updateDoc(records.docs[0].ref, {
        wordingChange: { from: "Fake", to: "Fake" },
      }),
    );
    await assertFails(deleteDoc(records.docs[0].ref));
    await assertFails(
      updateDoc(doc(serviceDb, assumptionPath), {
        statement: "Bypass",
        updatedBy: ownerId,
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("rejects fabricated wording history atomically", async () => {
    const batch = writeBatch(serviceDb);
    batch.update(doc(serviceDb, assumptionPath), {
      statement: "New text",
      lastWordingChangeId: "fake",
      updatedBy: ownerId,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(serviceDb, assumptionPath, "insights", "fake"), {
      wordingChange: { from: "Not the original", to: "New text" },
      createdBy: ownerId,
      authorEmail: actor.email,
      createdAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
    expect(
      (await getDoc(doc(serviceDb, assumptionPath))).data().statement,
    ).toBe("Original statement");
    expect(
      (await getDocs(collection(serviceDb, assumptionPath, "insights"))).size,
    ).toBe(0);
  });
  it("records initial and revised promises, including clearing, with no no-op record", async () => {
    await saveProjectBrief(projectId, actor, values, {});
    const next = {
      ...values,
      customerPromise: "",
      investorPromise: " Better return ",
    };
    await saveProjectBrief(projectId, actor, next, values);
    const normalized = { ...next, investorPromise: "Better return" };
    await saveProjectBrief(projectId, actor, normalized, normalized);
    const records = await loadPromiseHistory(projectId);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      from: values,
      to: normalized,
      authorEmail: actor.email,
      createdBy: ownerId,
    });
    expect(records[0].createdAt).toBeInstanceOf(Timestamp);
    await assertFails(
      updateDoc(doc(serviceDb, briefPath), {
        ...values,
        updatedBy: ownerId,
        updatedAt: serverTimestamp(),
      }),
    );
    const historyRef = doc(serviceDb, briefPath, "history", records[0].id);
    await assertFails(
      updateDoc(historyRef, { authorEmail: "forged@example.com" }),
    );
    await assertFails(deleteDoc(historyRef));
  });
  it("rejects stale promise edits and permits only one concurrent save", async () => {
    await saveProjectBrief(projectId, actor, values, {});
    const results = await Promise.allSettled([
      saveProjectBrief(
        projectId,
        actor,
        { ...values, customerPromise: "First" },
        values,
      ),
      saveProjectBrief(
        projectId,
        actor,
        { ...values, customerPromise: "Second" },
        values,
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected").reason.code,
    ).toBe("promise-conflict");
    expect(await loadPromiseHistory(projectId)).toHaveLength(2);
  });
  it("denies fabricated, orphan, and falsely attributed promise events", async () => {
    for (const override of [
      { from: { ...values, customerPromise: "Fake" } },
      { authorEmail: "forged@example.com" },
      { createdBy: otherUserId },
    ]) {
      const batch = writeBatch(serviceDb);
      batch.set(doc(serviceDb, briefPath), {
        ...values,
        updatedBy: ownerId,
        updatedAt: serverTimestamp(),
        lastWordingChangeId: "forged",
      });
      batch.set(doc(serviceDb, briefPath, "history", "forged"), {
        from: { customerPromise: "", investorPromise: "", coworkerPromise: "" },
        to: values,
        createdBy: ownerId,
        authorEmail: actor.email,
        createdAt: serverTimestamp(),
        ...override,
      });
      await assertFails(batch.commit());
    }
    await assertFails(
      setDoc(doc(serviceDb, briefPath, "history", "orphan"), {
        from: {},
        to: values,
        createdBy: ownerId,
        authorEmail: actor.email,
        createdAt: serverTimestamp(),
      }),
    );
    expect((await getDoc(doc(serviceDb, briefPath))).exists()).toBe(false);
  });
  it("keeps history private and available with formal reviews off", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), `projects/${projectId}`), {
        formalReviewsEnabled: false,
      });
    });
    await saveProjectBrief(projectId, actor, values, {});
    await updateAssumption(actor, projectId, "wording", "Revised");
    expect(await loadPromiseHistory(projectId)).toHaveLength(1);
    const outsider = verifiedContext(otherUserId).firestore();
    await assertFails(getDocs(collection(outsider, briefPath, "history")));
    await assertFails(
      getDocs(collection(outsider, assumptionPath, "insights")),
    );
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(
        doc(
          context.firestore(),
          `users/${ownerId}/projectMemberships/${projectId}`,
        ),
        { active: false },
      );
    });
    await assertFails(loadPromiseHistory(projectId));
    await assertFails(
      getDocs(collection(serviceDb, assumptionPath, "insights")),
    );
  });
});

describe("Project brief access and report sources", () => {
  beforeEach(async () => {
    await seedPrivateProject();
    serviceDb = verifiedContext(ownerId).firestore();
  });
  it("loads current state and preserves published content with reviews disabled", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await updateDoc(doc(db, "projects", projectId), {
        formalReviewsEnabled: false,
      });
      await setDoc(doc(db, "projects", projectId, "reviews", "r"), {
        title: "Historical review",
        publishedAt: Timestamp.now(),
        capturedAt: 1000,
        promises: { customerPromise: "Then" },
        assumptions: [
          { id: "a", statement: "Historical wording", insights: [] },
        ],
      });
      await setDoc(doc(db, "projects", projectId, "assumptions", "a"), {
        statement: "Today's wording",
      });
    });
    const current = await loadReportSource(projectId);
    expect(current.assumptions[0].statement).toBe("Today's wording");
    const comparison = await loadReportComparison(
      projectId,
      current,
      await loadReportReviews(projectId),
    );
    expect(comparison.wordingChanged).toBe(1);
    expect(comparison.newInsights).toBe(0);
    const historical = await loadReportSource(projectId, "r");
    expect(historical.assumptions[0].statement).toBe("Historical wording");
    expect(historical.assumptions[0]).not.toHaveProperty("nextStep");
  });
  it("denies report loading and print access checks for outsiders and removed members", async () => {
    serviceDb = verifiedContext(otherUserId).firestore();
    await assertFails(loadReportSource(projectId));
    await assertFails(verifyReportAccess(projectId));
    await assertFails(
      loadReportComparison(
        projectId,
        { kind: "current", assumptions: [{ id: "a" }] },
        [
          {
            id: "r",
            publishedAt: Timestamp.now(),
            capturedAt: 1,
            assumptions: [],
          },
        ],
      ),
    );
    serviceDb = verifiedContext(ownerId).firestore();
    await assertSucceeds(verifyReportAccess(projectId));
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(
        doc(
          context.firestore(),
          "users",
          ownerId,
          "projectMemberships",
          projectId,
        ),
        { active: false },
      );
    });
    await assertFails(loadReportSource(projectId));
    await assertFails(verifyReportAccess(projectId));
    await assertFails(
      loadReportComparison(
        projectId,
        { kind: "current", assumptions: [{ id: "a" }] },
        [
          {
            id: "r",
            publishedAt: Timestamp.now(),
            capturedAt: 1,
            assumptions: [],
          },
        ],
      ),
    );
  });
});

describe("Candidate grouping and atomic combination", () => {
  const actor = { uid: ownerId, email: "owner@example.com" };
  const candidate = (id) =>
    doc(serviceDb, "projects", projectId, "candidates", id);
  beforeEach(async () => {
    await seedPrivateProject();
    serviceDb = testEnv
      .authenticatedContext(ownerId, {
        email_verified: true,
        email: actor.email,
      })
      .firestore();
  });
  it("saves groups, reorders legacy cards with tied positions, combines eight sources, and adopts the result", async () => {
    const {
      saveCandidateGroup,
      moveCandidate,
      combineCandidates,
      loadCandidateGroups,
    } = await import("../../src/features/candidates/boardService.js");
    await saveCandidateGroup(actor, projectId, "g", "Delivery");
    expect((await loadCandidateGroups(projectId))[0].name).toBe("Delivery");
    await saveCandidateGroup(actor, projectId, "g", "Delivery");
    const rows = await addCandidates(
      actor,
      projectId,
      Array.from({ length: 8 }, (_, i) => `Idea ${i}`).join("\n"),
    );
    const moved = await moveCandidate(actor, projectId, rows[0], "g", [
      rows[0],
    ]);
    expect((await getDoc(candidate(rows[0].id))).data().groupId).toBe("g");
    const sources = [moved[0], ...rows.slice(1)];
    const combined = await combineCandidates(
      actor,
      projectId,
      "combined",
      sources,
      "We can deliver.",
    );
    expect(combined.sourceCandidateIds).toHaveLength(8);
    expect(combined.groupId).toBe("g");
    for (const row of rows) {
      const saved = (await getDoc(candidate(row.id))).data();
      expect(saved.status).toBe("combined");
      expect(saved.statement).toBe(row.statement);
      await assertFails(
        updateDoc(candidate(row.id), {
          statement: "Erased",
          updatedBy: ownerId,
          updatedAt: serverTimestamp(),
        }),
      );
    }
    await combineCandidates(
      actor,
      projectId,
      "combined",
      sources,
      "We can deliver.",
    );
    expect(await loadCandidates(projectId)).toHaveLength(9);
    await adoptCandidate(actor, projectId, combined.id, combined.statement);
    expect((await loadAssumptions(projectId))[0].sourceCandidateId).toBe(
      "combined",
    );
    await expect(
      moveCandidate(actor, projectId, combined, "ungrouped", [combined]),
    ).rejects.toThrow(/no longer pending/);
    await assertFails(
      updateDoc(candidate(combined.id), {
        groupId: "ungrouped",
        rank: 1024,
        updatedBy: ownerId,
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("rejects a changed source without partial writes and permits only one competing combination", async () => {
    const { combineCandidates } =
      await import("../../src/features/candidates/boardService.js");
    const rows = await addCandidates(actor, projectId, "First\nSecond");
    await editCandidate(actor, projectId, rows[0].id, "Revised");
    await expect(
      combineCandidates(actor, projectId, "stale", rows, "Combined"),
    ).rejects.toThrow(/changed/);
    expect((await getDoc(candidate("stale"))).exists()).toBe(false);
    expect((await getDoc(candidate(rows[1].id))).data().status).toBe("pending");
    const current = await loadCandidates(projectId);
    const results = await Promise.allSettled([
      combineCandidates(actor, projectId, "one", current, "One"),
      combineCandidates(actor, projectId, "two", current, "Two"),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      (await loadCandidates(projectId)).filter(
        (row) => row.status === "pending",
      ),
    ).toHaveLength(1);
  });
  it("denies forged sources, unilateral retirement, reuse of a saved target, and metadata tampering", async () => {
    const { combineCandidates } =
      await import("../../src/features/candidates/boardService.js");
    const rows = await addCandidates(actor, projectId, "First\nSecond\nThird");
    const raw = {
      statement: "Forged",
      status: "pending",
      createdBy: ownerId,
      authorEmail: actor.email,
      createdAt: serverTimestamp(),
      sourceCandidateIds: [rows[0].id, rows[1].id],
    };
    await assertFails(setDoc(candidate("forged"), raw));
    await assertFails(
      updateDoc(candidate(rows[0].id), {
        status: "combined",
        combinedInto: "missing",
        combinedBy: ownerId,
        combinedAt: serverTimestamp(),
      }),
    );
    await combineCandidates(
      actor,
      projectId,
      "real",
      rows.slice(0, 2),
      "Combined",
    );
    await assertFails(
      updateDoc(candidate(rows[2].id), {
        status: "combined",
        combinedInto: "real",
        combinedBy: ownerId,
        combinedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(candidate("real"), { sourceCandidateIds: [rows[2].id] }),
    );
    await assertFails(deleteDoc(candidate(rows[0].id)));
    await assertFails(
      updateDoc(candidate(rows[2].id), {
        groupId: "missing",
        rank: 1,
        updatedBy: ownerId,
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("preserves nested combination provenance and detects stale movement", async () => {
    const { combineCandidates, moveCandidate } =
      await import("../../src/features/candidates/boardService.js");
    const rows = await addCandidates(actor, projectId, "First\nSecond\nThird");
    const first = await combineCandidates(
      actor,
      projectId,
      "parent",
      rows.slice(0, 2),
      "Parent",
    );
    await combineCandidates(
      actor,
      projectId,
      "child",
      [first, rows[2]],
      "Child",
    );
    expect(
      (await getDoc(candidate("parent"))).data().sourceCandidateIds,
    ).toEqual(rows.slice(0, 2).map((row) => row.id));
    const extra = await addCandidates(actor, projectId, "Fourth\nFifth");
    const current = await moveCandidate(
      actor,
      projectId,
      extra[0],
      "ungrouped",
      extra,
    );
    await moveCandidate(actor, projectId, current[1], "ungrouped", [
      current[1],
      current[0],
    ]);
    await expect(
      moveCandidate(actor, projectId, current[0], "ungrouped", current),
    ).rejects.toThrow(/Someone moved/);
  });
  it("denies group and candidate changes for outsiders and removed members", async () => {
    const {
      saveCandidateGroup,
      loadCandidateGroups,
      combineCandidates,
      moveCandidate,
    } = await import("../../src/features/candidates/boardService.js");
    const rows = await addCandidates(actor, projectId, "First\nSecond");
    await saveCandidateGroup(actor, projectId, "g", "Group");
    serviceDb = verifiedContext(otherUserId).firestore();
    await assertFails(loadCandidateGroups(projectId));
    await assertFails(
      saveCandidateGroup(
        { uid: otherUserId, email: "other@example.com" },
        projectId,
        "bad",
        "Bad",
      ),
    );
    await assertFails(
      combineCandidates(
        { uid: otherUserId, email: "other@example.com" },
        projectId,
        "bad-combine",
        rows,
        "Bad",
      ),
    );
    await assertFails(
      moveCandidate(
        { uid: otherUserId, email: "other@example.com" },
        projectId,
        rows[0],
        "g",
        [rows[0]],
      ),
    );
    await testEnv.withSecurityRulesDisabled(async (context) =>
      updateDoc(
        doc(
          context.firestore(),
          "users",
          ownerId,
          "projectMemberships",
          projectId,
        ),
        { active: false },
      ),
    );
    serviceDb = testEnv
      .authenticatedContext(ownerId, {
        email_verified: true,
        email: actor.email,
      })
      .firestore();
    await assertFails(loadCandidateGroups(projectId));
    await assertFails(
      combineCandidates(actor, projectId, "removed", rows, "Removed"),
    );
  });
});

describe("Personal project welcome", () => {
  it("persists an active member's visit without changing their membership", async () => {
    await seedPrivateProject();
    serviceDb = verifiedContext(ownerId).firestore();
    const { hasSeenWelcome, rememberWelcome } =
      await import("../../src/features/welcome/welcomeService.js");
    expect(await hasSeenWelcome(ownerId, projectId)).toBe(false);
    await assertSucceeds(rememberWelcome(ownerId, projectId));
    expect(await hasSeenWelcome(ownerId, projectId)).toBe(true);
    await assertSucceeds(rememberWelcome(ownerId, projectId));
    expect(
      (
        await adminDocument(`users/${ownerId}/projectMemberships/${projectId}`)
      ).data().role,
    ).toBe("owner");
  });
  it("rejects other users, nonmembers, invalid fields, and removed members", async () => {
    await seedPrivateProject();
    const owner = verifiedContext(ownerId).firestore();
    const other = verifiedContext(otherUserId).firestore();
    const path = `users/${ownerId}/projectWelcome/${projectId}`;
    const value = () => ({ version: 1, seenAt: serverTimestamp() });
    await assertFails(setDoc(doc(other, path), value()));
    await assertFails(getDoc(doc(other, path)));
    await assertFails(
      setDoc(
        doc(other, `users/${otherUserId}/projectWelcome/${projectId}`),
        value(),
      ),
    );
    await assertFails(setDoc(doc(owner, path), { ...value(), role: "owner" }));
    await assertFails(
      setDoc(doc(owner, path), { version: 2, seenAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(owner, path), { version: 1, seenAt: Timestamp.fromMillis(0) }),
    );
    await assertSucceeds(setDoc(doc(owner, path), value()));
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(
        doc(
          context.firestore(),
          `users/${ownerId}/projectMemberships/${projectId}`,
        ),
        { active: false },
      );
    });
    await assertFails(getDoc(doc(owner, path)));
    await assertFails(setDoc(doc(owner, path), value()));
  });
});
