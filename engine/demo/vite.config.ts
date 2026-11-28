import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5323,
    proxy: {
      "/state": "http://127.0.0.1:5322",
      "/notices": "http://127.0.0.1:5322",
      "/decisions": "http://127.0.0.1:5322",
      "/demo": "http://127.0.0.1:5322",
    },
  },
  test: { environment: "jsdom", include: ["tests/**/*.test.tsx"] },
});
