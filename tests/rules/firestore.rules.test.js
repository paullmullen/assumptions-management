import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

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
