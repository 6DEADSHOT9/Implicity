import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const preview = resolve(dirname(fileURLToPath(import.meta.url)), "../dist/preview.html");
await access(preview);
const html = await readFile(preview, "utf8");
if (!html.includes("Skeleton preview") || !/src="(?:\.\/|\/)assets\/preview-[^"]+\.js/.test(html)) {
  throw new Error("Production preview page is missing its runtime bundle");
}
