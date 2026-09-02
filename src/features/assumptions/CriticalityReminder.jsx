import { Alert } from "antd";

export default function CriticalityReminder({ original, value }) {
  if (
    !Number.isInteger(original) ||
    !Number.isInteger(value) ||
    original === value
  )
    return null;
  return (
    <Alert
      type="info"
      role="status"
      title="Changes in criticality are unusual. Has the consequence of being wrong changed, or have you learned more about whether the assumption is true? If only your confidence changed, adjust evidence instead."
    />
  );
}
