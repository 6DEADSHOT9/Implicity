import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default {
  envDir: "..",
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "ajv-formats/dist/formats": fileURLToPath(new URL("./node_modules/ajv-formats/dist/formats.js", import.meta.url)),
      "ajv/dist/runtime/equal": fileURLToPath(new URL("./node_modules/ajv/dist/runtime/equal.js", import.meta.url)),
    },
  },
  build: { rollupOptions: { input: { gallery: "index.html", preview: "preview.html" } } },
};
