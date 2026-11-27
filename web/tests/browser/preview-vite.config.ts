import { defineConfig } from "vite";

export default defineConfig({
  preview: { headers: { "Cache-Control": "private, max-age=3600" } },
});
