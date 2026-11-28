import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

export default [
  { ignores: ["node_modules/**", "**/dist/**", "src/contracts/event-validator.js"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: { "no-unused-vars": "off" },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: { "no-undef": "off" },
  },
];
