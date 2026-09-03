import { beforeEach, expect, it, vi } from "vitest";
import { onSnapshot } from "firebase/firestore";
import { watchReviewPreference } from "./reviewPreference.js";

vi.mock("../../firebase.js", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => "project-ref"),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());

it("waits for acknowledgement metadata instead of publishing a pending preference", () => {
  const onChange = vi.fn();
  const onError = vi.fn();
  const unsubscribe = vi.fn();
  onSnapshot.mockReturnValue(unsubscribe);
  expect(watchReviewPreference("p", onChange, onError)).toBe(unsubscribe);
  const [, options, receive] = onSnapshot.mock.calls[0];
  expect(options).toEqual({ includeMetadataChanges: true });
  const snapshot = (enabled, pending) => ({
    metadata: { hasPendingWrites: pending },
    exists: () => true,
    data: () => ({ formalReviewsEnabled: enabled }),
  });
  receive(snapshot(true, false));
  receive(snapshot(false, true));
  expect(onChange.mock.calls).toEqual([[true]]);
  receive(snapshot(false, false));
  expect(onChange.mock.calls).toEqual([[true], [false]]);
  expect(onError).not.toHaveBeenCalled();
});

it("keeps legacy projects enabled and reports unavailable projects", () => {
  const onChange = vi.fn();
  const onError = vi.fn();
  watchReviewPreference("p", onChange, onError);
  const receive = onSnapshot.mock.calls[0][2];
  receive({
    metadata: { hasPendingWrites: false },
    exists: () => true,
    data: () => ({}),
  });
  expect(onChange).toHaveBeenCalledWith(true);
  receive({ metadata: { hasPendingWrites: false }, exists: () => false });
  expect(onError).toHaveBeenCalledWith(expect.any(Error));
});
