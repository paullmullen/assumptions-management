import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const runningRulesTests = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    exclude: runningRulesTests
      ? ["node_modules/**", "dist/**"]
      : ["tests/rules/**", "node_modules/**", "dist/**"],
  },
});
