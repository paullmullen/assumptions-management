import { writeFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
const created = [];
const fixtures = {
  "email-service/.env.local":
    "AUTH_EMAIL_FROM=emulator@example.invalid\nAUTH_EMAIL_APP_URL=https://demo-auth-email.web.app\nAUTH_EMAIL_ACTION_ORIGIN=https://demo-auth-email.firebaseapp.com\n",
  "email-service/.secret.local":
    "SMTP2GO_API_KEY=emulator-not-a-real-key\nAUTH_EMAIL_RATE_SECRET=emulator-only-rate-secret-not-for-production-12345\n",
};
try {
  for (const [path, text] of Object.entries(fixtures)) {
    try {
      await writeFile(path, text, { flag: "wx", mode: 0o600 });
      created.push(path);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      "firebase",
      [
        "emulators:exec",
        "--project",
        "demo-auth-email",
        "--config",
        "firebase.email-test.json",
        "--only",
        "auth,firestore,functions",
        "vitest run email-service/integration.test.js --testTimeout 30000 --hookTimeout 30000",
      ],
      { stdio: "inherit", shell: process.platform === "win32" },
    );
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
} finally {
  for (const path of created) await unlink(path);
}
