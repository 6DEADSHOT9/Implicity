import { defineConfig } from "@playwright/test";

const testPort = Number((globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.GALLERY_TEST_PORT ?? 5174);
const previewPort = Number((globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.GALLERY_PREVIEW_PORT ?? 4174);

export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: `http://127.0.0.1:${testPort}`, browserName: "chromium", viewport: { width: 1201, height: 900 } },
  webServer: [
    { command: `pnpm exec vite --host 127.0.0.1 --port ${testPort} --strictPort`, url: `http://127.0.0.1:${testPort}`, reuseExistingServer: false },
    { command: `pnpm exec vite preview --host 127.0.0.1 --port ${previewPort} --strictPort`, url: `http://127.0.0.1:${previewPort}`, reuseExistingServer: false },
  ],
});
