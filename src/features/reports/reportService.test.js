import { beforeEach, expect, it, vi } from "vitest";
import { getDocFromServer, getDocsFromServer } from "firebase/firestore";
import { loadReportSource } from "./reportService.js";
vi.mock("../../firebase.js", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db, ...parts) => parts.join("/"),
  collection: (_db, ...parts) => parts.join("/"),
  getDocFromServer: vi.fn(),
  getDocsFromServer: vi.fn(),
}));
const snapshot = (data) => ({ exists: () => Boolean(data), data: () => data });
beforeEach(() => vi.clearAllMocks());
it("loads saved current data without requiring formal reviews", async () => {
  getDocFromServer.mockImplementation(async (path) =>
    snapshot(
      path.endsWith("overview")
        ? { customerPromise: "Saved promise" }
        : { name: "Project", formalReviewsEnabled: false },
    ),
  );
  getDocsFromServer.mockResolvedValue({
    docs: [
      {
        id: "a",
        data: () => ({
          statement: "Saved wording",
          criticality: 0,
          evidence: 0,
        }),
      },
    ],
  });
  const result = await loadReportSource("p");
  expect(result.kind).toBe("current");
  expect(result.promises.customerPromise).toBe("Saved promise");
  expect(result.assumptions[0].criticality).toBe(0);
});
it("uses review content alone and never fills missing historical fields from current data", async () => {
  getDocFromServer.mockImplementation(async (path) =>
    snapshot(
      path.includes("reviews")
        ? {
            title: "Review",
            capturedAt: 100,
            publishedAt: { toMillis: () => 200 },
            promises: { customerPromise: "Historical promise" },
            assumptions: [{ id: "old", statement: "Old wording" }],
          }
        : { name: "Current name" },
    ),
  );
  const result = await loadReportSource("p", "r");
  expect(result.kind).toBe("review");
  expect(result.assumptions[0]).not.toHaveProperty("nextStep");
  expect(result.projectName).toBe("Current name");
  expect(getDocsFromServer).not.toHaveBeenCalled();
});
it("rejects an incomplete load rather than returning a partial report", async () => {
  getDocFromServer.mockResolvedValue(snapshot({ name: "Project" }));
  getDocsFromServer.mockRejectedValue(new Error("offline"));
  await expect(loadReportSource("p")).rejects.toThrow("offline");
});

it("loads comparison history from the project and rejects partial history failures", async () => {
  const { loadReportComparison } = await import("./reportService.js");
  const baseline = {
    id: "r",
    capturedAt: 1,
    publishedAt: { toMillis: () => 2 },
    assumptions: [{ id: "a", insights: [] }],
  };
  getDocFromServer.mockResolvedValue(snapshot({ name: "Project" }));
  getDocsFromServer.mockResolvedValue({
    docs: [{ id: "i", data: () => ({ description: "New learning" }) }],
  });
  const source = { kind: "current", assumptions: [{ id: "a" }] };
  expect(
    (await loadReportComparison("p", source, [baseline])).newInsights,
  ).toBe(1);
  expect(getDocsFromServer).toHaveBeenCalledWith(
    "projects/p/assumptions/a/insights",
  );
  getDocsFromServer.mockRejectedValue(new Error("offline"));
  await expect(loadReportComparison("p", source, [baseline])).rejects.toThrow(
    "offline",
  );
});
it("historical comparisons never request live insight data", async () => {
  const { loadReportComparison } = await import("./reportService.js");
  getDocFromServer.mockResolvedValue(snapshot({ name: "Project" }));
  await loadReportComparison(
    "p",
    { kind: "review", publishedAt: 4, capturedAt: 3, assumptions: [] },
    [
      {
        id: "r",
        capturedAt: 1,
        publishedAt: { toMillis: () => 2 },
        assumptions: [],
      },
    ],
  );
  expect(getDocsFromServer).not.toHaveBeenCalled();
});
