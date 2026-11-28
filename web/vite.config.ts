import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default {
  plugins: [tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    fs: { deny: ["**/data/**"] },
    proxy: { "/api": process.env.VITE_API_TARGET ?? "http://127.0.0.1:8000" },
  },
  build: { rollupOptions: { input: { gallery: "index.html", preview: "preview.html", chat: "chat.html" } } },
};
