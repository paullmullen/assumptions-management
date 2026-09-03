import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, App, Button, Modal, Space } from "antd";
import { DraftContext } from "./draftContext.js";

export default function DraftProvider({ children }) {
  const entries = useRef(new Map());
  const pendingAction = useRef(null);
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { message } = App.useApp();
  const register = useCallback(
    (id, entry) => entries.current.set(id, entry),
    [],
  );
  const unregister = useCallback((id) => {
    entries.current.delete(id);
    // Revoked access or an authentication change must also dismiss private draft UI.
    if (pendingAction.current?.ids.includes(id)) {
      pendingAction.current = null;
      setPending(null);
    }
  }, []);
  const request = useCallback(
    (action) => {
      if (pendingAction.current) return;
      const all = [...entries.current.entries()];
      if (all.some(([, entry]) => entry.busy)) {
        message.info(
          "Please wait for the current save to finish, then try again.",
        );
        return;
      }
      const dirty = all.filter(([, entry]) => entry.dirty);
      if (!dirty.length) return action();
      const next = {
        action,
        ids: dirty.map(([id]) => id),
        labels: dirty.map(([, entry]) => entry.label),
        canSave: dirty.every(([, entry]) => Boolean(entry.save)),
      };
      pendingAction.current = next;
      setError("");
      setPending(next);
    },
    [message],
  );
  useEffect(() => {
    function beforeUnload(event) {
      if (
        [...entries.current.values()].some((entry) => entry.dirty || entry.busy)
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  const value = useMemo(
    () => ({ register, unregister, request }),
    [register, unregister, request],
  );
  function cancel() {
    if (saving) return;
    pendingAction.current = null;
    setPending(null);
  }
  async function proceed(save) {
    const current = pendingAction.current;
    if (!current || saving) return;
    setSaving(true);
    setError("");
    try {
      for (const id of current.ids) {
        if (pendingAction.current !== current) return;
        const entry = entries.current.get(id);
        if (!entry) return;
        if (save) {
          if (entry.dirty && (!entry.save || (await entry.save()) === false)) {
            setError(
              "Changes were not saved. Keep editing to correct the fields, or retry saving.",
            );
            return;
          }
        } else entry.discard();
      }
      if (pendingAction.current !== current) return;
      pendingAction.current = null;
      setPending(null);
      current.action();
    } catch {
      setError("Changes could not be saved. Your edits are retained.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <DraftContext.Provider value={value}>
      {children}
      <Modal
        title="Unsaved changes"
        open={Boolean(pending)}
        onCancel={cancel}
        mask={{ closable: false }}
        closable={!saving}
        keyboard={!saving}
        footer={
          <Space wrap>
            <Button autoFocus disabled={saving} onClick={cancel}>
              Keep editing
            </Button>
            <Button danger disabled={saving} onClick={() => proceed(false)}>
              Discard changes
            </Button>
            {pending?.canSave && (
              <Button
                type="primary"
                loading={saving}
                onClick={() => proceed(true)}
              >
                Save and continue
              </Button>
            )}
          </Space>
        }
      >
        <p>
          You have unsaved work in: {pending?.labels.join(", ")}. What would you
          like to do?
        </p>
        {!pending?.canSave && (
          <p>Finish this action in its editor before leaving.</p>
        )}
        {error && <Alert type="error" role="alert" title={error} />}
      </Modal>
    </DraftContext.Provider>
  );
}
