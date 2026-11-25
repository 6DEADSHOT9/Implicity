import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const preview = resolve(dirname(fileURLToPath(import.meta.url)), "../dist/preview.html");
await access(preview);
const html = await readFile(preview, "utf8");
const entry = html.match(/src="(?:\.\/|\/)assets\/(preview-[^"]+\.js)"/)?.[1];
if (!html.includes("Skeleton preview") || !entry) {
  throw new Error("Production preview page is missing its runtime bundle");
}
const bundle = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), `../dist/assets/${entry}`), "utf8");
const staticImports = [...bundle.matchAll(/\bfrom["']([^"']+)["']/g)].map((match) => match[1]);
if (staticImports.some((path) => /(?:registry|ReviewPanel|ReviewShell)/i.test(path))) {
  throw new Error("Production preview bundle statically imports registry entries");
}
