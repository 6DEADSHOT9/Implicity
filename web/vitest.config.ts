import { defineConfig } from "vitest/config";

export default defineConfig({ test: {
  environment: "node",
  include: ["tests/**/*.test.{js,ts,tsx}", "src/registry/**/*.test.{js,ts,tsx}"],
  exclude: ["tests/browser/**", "node_modules/**", "dist/**", "test-results/**"],
} });
