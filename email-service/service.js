import { createHmac, randomUUID } from "node:crypto";
import { renderAuthEmail } from "./templates.js";

export class AuthEmailError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function createAuthEmailService({
  auth,
  store,
  send,
  appUrl,
  actionOrigin,
  rateSecret,
  now = Date.now,
  allowEmulatorLinks = false,
}) {
  const url = new URL(appUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    rateSecret.length < 32
  )
    throw new Error("Invalid authentication email configuration.");
  const hash = (scope) =>
    createHmac("sha256", rateSecret).update(scope).digest("hex");
  return {
    // Only a trusted callable adapter may provide auth, app, and ip context.
    async request({ data, auth: caller, app, ip }) {
      if (!app?.appId)
        throw new AuthEmailError(
          "failed-precondition",
          "Reload the app and try again.",
        );
      if (
        !data ||
        !["verify", "reset"].includes(data.kind) ||
        Object.keys(data).some((key) => !["kind", "email"].includes(key))
      )
        throw new AuthEmailError("invalid-argument", "Invalid email request.");
      if (data.kind === "verify" && (!caller?.uid || "email" in data))
        throw new AuthEmailError(
          "unauthenticated",
          "Sign in before requesting verification.",
        );
      const email =
        typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
      if (
        data.kind === "reset" &&
        (email.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email))
      )
        throw new AuthEmailError(
          "invalid-argument",
          "Enter a valid email address.",
        );
      const identity = data.kind === "verify" ? caller.uid : email;
      const time = now();
      const job = {
        id: randomUUID(),
        kind: data.kind,
        ...(data.kind === "verify" ? { uid: caller.uid } : { email }),
        status: "pending",
        createdAt: time,
        expiresAt: time + 86400000,
      };
      const accepted = await store.enqueue(
        job,
        [
          { id: hash(`${data.kind}:${identity}`), limit: 5, cooldownMs: 60000 },
          { id: hash(`ip:${ip || "unknown"}`), limit: 30, cooldownMs: 0 },
          { id: hash("global"), limit: 500, cooldownMs: 0 },
        ],
        time,
      );
      if (!accepted)
        throw new AuthEmailError(
          "resource-exhausted",
          "Please wait before requesting another email.",
        );
      // Reset requests do not look up accounts or contact the provider here.
      // Known and unknown addresses have the same queued acknowledgement.
      return { accepted: true };
    },
    async process(jobId) {
      const job = await store.claim(jobId, now());
      if (!job) return;
      let outcome = "failed";
      try {
        let user;
        try {
          user =
            job.kind === "verify"
              ? await auth.getUser(job.uid)
              : await auth.getUserByEmail(job.email);
        } catch (error) {
          if (error.code !== "auth/user-not-found") throw error;
        }
        if (
          !user ||
          user.disabled ||
          !user.email ||
          (job.kind === "verify" && user.emailVerified)
        ) {
          outcome = "skipped";
        } else {
          const settings = { url: appUrl, handleCodeInApp: false };
          const link =
            job.kind === "verify"
              ? await auth.generateEmailVerificationLink(user.email, settings)
              : await auth.generatePasswordResetLink(user.email, settings);
          await send({
            to: user.email,
            ...renderAuthEmail(
              job.kind,
              link,
              actionOrigin,
              allowEmulatorLinks,
            ),
          });
          outcome = "accepted-by-provider";
        }
      } catch {
        // Job status is diagnostic; no raw SDK/provider exceptions or links.
        outcome = "failed";
      }
      await store.finish(jobId, outcome, now());
      return outcome;
    },
  };
}
