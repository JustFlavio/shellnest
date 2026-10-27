import js from "@eslint/js";
import globals from "globals";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const controlComponents = [
  "Input",
  "PasswordInput",
  "SelectField",
  "Textarea",
  "HostPasswordInput",
  "Combo",
];

export default tseslint.config(
  {
    ignores: [
      "dist/",
      "node_modules/",
      "src-tauri/",
      "e2e/visual-snapshots/",
      "sync/data/",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [
      jsxA11y.flatConfigs.recommended,
      reactHooks.configs.flat["recommended-latest"],
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "jsx-a11y/label-has-associated-control": [
        "error",
        {
          controlComponents: controlComponents,
          assert: "either",
          depth: 4,
        },
      ],
      // Dialogs focus their first field on open; only native elements are checked.
      "jsx-a11y/no-autofocus": ["error", { ignoreNonDOM: true }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Input validation rejects control characters on purpose.
      "no-control-regex": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["**/*.test.*"],
    rules: {
      // node:test registers top-level tests and reports their promises itself.
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  {
    // Playwright callbacks passed to page.evaluate run in the browser.
    files: ["e2e/**", "sync/**", "*.config.*"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["e2e/desktop.spec.*"],
    languageOptions: { globals: { ...globals.mocha, browser: "readonly" } },
  },
);
