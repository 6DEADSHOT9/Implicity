import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default {
  envDir: "..",
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: { rollupOptions: { input: { gallery: "index.html", preview: "preview.html" } } },
};
