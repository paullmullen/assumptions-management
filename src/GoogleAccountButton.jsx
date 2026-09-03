import { useState } from "react";
import { App, Button } from "antd";
import { connectGoogleAccount, hasGoogleAccount } from "./googleAuth.js";
import { authenticationErrorMessage } from "./authErrors.js";
import { useNavigationGuard } from "./features/workspace/draftContext.js";

export default function GoogleAccountButton({ user }) {
  const [busy, setBusy] = useState(false);
  const { message } = App.useApp();
  const guard = useNavigationGuard();
  if (hasGoogleAccount(user)) return null;

  async function connect() {
    setBusy(true);
    try {
      await connectGoogleAccount(user);
      window.location.reload();
    } catch (error) {
      message.error(authenticationErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button loading={busy} onClick={() => guard(connect)}>
      Connect Google account
    </Button>
  );
}
