import { httpsCallable } from "firebase/functions";

// Callable delivery never accepts a client-selected verification recipient.
export function createAuthEmailClient(functions) {
  const request = httpsCallable(functions, "requestAuthEmail");
  async function send(data) {
    const result = await request(data);
    if (result.data?.accepted !== true)
      throw new Error("The email request was not accepted.");
  }
  return {
    sendVerificationEmail: () => send({ kind: "verify" }),
    sendPasswordResetEmail: (email) => send({ kind: "reset", email }),
  };
}
