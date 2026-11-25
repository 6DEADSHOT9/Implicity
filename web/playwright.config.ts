import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: "http://127.0.0.1:5173", browserName: "chromium", viewport: { width: 1201, height: 900 } },
  webServer: { command: "pnpm exec vite --host 127.0.0.1 --strictPort", url: "http://127.0.0.1:5173", reuseExistingServer: false },
});
