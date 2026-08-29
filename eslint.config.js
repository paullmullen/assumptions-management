import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist", "node_modules", ".firebase"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs["recommended-latest"].rules,
      ...reactRefresh.configs.vite.rules,
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },
  {
    files: ["vite.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.jsx"],
    rules: {
      // Core ESLint does not mark identifiers used only through JSX as used.
      "no-unused-vars": "off",
    },
  },
];
