import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { error as logError } from "firebase-functions/logger";
import { createAuthEmailService, AuthEmailError } from "./service.js";
import { createFirestoreEmailStore } from "./firestore-store.js";
import { createSmtp2goSender } from "./smtp2go.js";

initializeApp();
const local = process.env.FUNCTIONS_EMULATOR === "true";
const apiKey = defineSecret("SMTP2GO_API_KEY");
const rateSecret = defineSecret("AUTH_EMAIL_RATE_SECRET");
const sender = defineString("AUTH_EMAIL_FROM", {
  description: "Verified SMTP2GO sender email address (no display name).",
});
const appUrl = defineString("AUTH_EMAIL_APP_URL", {
  default: "https://assumptions-management.web.app",
});
const actionOrigin = defineString("AUTH_EMAIL_ACTION_ORIGIN", {
  default: "https://assumptions-management.firebaseapp.com",
});

function service() {
  const db = getFirestore();
  const send = local
    ? async (mail) => {
        // Local emulator only: capture to its private outbox; never contact SMTP2GO.
        await db.collection("authEmailTestOutbox").add(mail);
      }
    : createSmtp2goSender({ apiKey: apiKey.value(), sender: sender.value() });
  return createAuthEmailService({
    auth: getAuth(),
    store: createFirestoreEmailStore(db),
    send,
    appUrl: appUrl.value(),
    actionOrigin: local
      ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`
      : actionOrigin.value(),
    allowEmulatorLinks: local,
    rateSecret: rateSecret.value(),
  });
}

export const requestAuthEmail = onCall(
  {
    region: "us-central1",
    enforceAppCheck: !local,
    maxInstances: 5,
    secrets: [apiKey, rateSecret],
  },
  async (request) => {
    try {
      return await service().request({
        data: request.data,
        auth: request.auth,
        // App Check has no local emulator. Auth validation still runs locally.
        app: local ? { appId: "local-emulator" } : request.app,
        ip: request.rawRequest.ip,
      });
    } catch (error) {
      if (error instanceof AuthEmailError)
        throw new HttpsError(error.code, error.message);
      logError("auth_email_request_failed");
      throw new HttpsError(
        "unavailable",
        "Email requests are temporarily unavailable.",
      );
    }
  },
);

export const deliverAuthEmail = onDocumentCreated(
  {
    document: "authEmailJobs/{jobId}",
    region: "us-central1",
    retry: false,
    maxInstances: 5,
    secrets: [apiKey, rateSecret],
  },
  async (event) => {
    try {
      const outcome = await service().process(event.params.jobId);
      if (outcome === "failed") logError("auth_email_delivery_unconfirmed");
    } catch {
      // Retain the claimed job for inspection; never log credentials or links.
      logError("auth_email_worker_failed");
    }
  },
);
