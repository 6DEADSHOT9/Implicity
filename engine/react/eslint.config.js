import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: tsParser },
    rules: {
      "no-restricted-imports": ["error", {
        patterns: ["**/app/**", "**/api/**", "**/web/**", "**/chat/**", "**/memory/**", "**/hermes/**"],
        paths: ["@implicity/app", "@implicity/api", "@implicity/web", "@implicity/chat", "@implicity/memory", "@implicity/hermes"],
      }],
    },
  },
];
