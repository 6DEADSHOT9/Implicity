import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.{js,ts,tsx}", "src/registry/**/*.test.{js,ts,tsx}"],
    exclude: ["tests/browser/**", "node_modules/**", "dist/**", "test-results/**"],
  },
});
