import { defineConfig } from "@playwright/test";

const testPort = Number((globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.GALLERY_TEST_PORT ?? 5174);
const previewPort = Number((globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.GALLERY_PREVIEW_PORT ?? 4174);

export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: `http://127.0.0.1:${testPort}`, browserName: "chromium", viewport: { width: 1201, height: 900 } },
  webServer: [
    // A fake key and an intercepted host, with the gallery opt-in off, so gallery-capture.spec.ts can prove the gallery stays silent.
    { command: `pnpm exec vite --host 127.0.0.1 --port ${testPort} --strictPort`, url: `http://127.0.0.1:${testPort}`, reuseExistingServer: false, env: { VITE_POSTHOG_API_KEY: "phc_browser_test_key", VITE_POSTHOG_HOST: "http://posthog.invalid", VITE_GALLERY_CAPTURE_ENABLED: "false" } },
    { command: `pnpm exec vite preview --config tests/browser/preview-vite.config.ts --host 127.0.0.1 --port ${previewPort} --strictPort`, url: `http://127.0.0.1:${previewPort}`, reuseExistingServer: false },
  ],
});
