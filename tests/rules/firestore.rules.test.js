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
  saveAssumptionChanges,
  addInsight,
} from "../../src/services.js";
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

    await assertSucceeds(setDoc(briefRef, projectBrief()));
    await assertSucceeds(
      setDoc(briefRef, {
        ...projectBrief(),
        customerPromise:
          "Customers will complete the process more confidently.",
      }),
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

    await assertSucceeds(
      updateDoc(assumptionRef, {
        statement: "Customers will complete the workflow without assistance.",
        updatedAt: Timestamp.now(),
        updatedBy: ownerId,
      }),
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
