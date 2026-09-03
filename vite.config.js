import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const runningRulesTests = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST,
);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    exclude: runningRulesTests
      ? ["**/node_modules/**", "dist/**"]
      : [
          "tests/rules/**",
          "tests/auth/**",
          "email-service/integration.test.js",
          "email-service/admin-integration.test.js",
          "**/node_modules/**",
          "dist/**",
        ],
  },
});
