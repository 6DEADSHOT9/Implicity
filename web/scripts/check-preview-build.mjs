import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = resolve(web, "tests/fixtures/ReviewPanel");
const target = resolve(web, "src/registry/ReviewPanel");
const assets = resolve(web, "dist/assets");

let fixtureCreated = false;
try {
  await mkdir(target);
  fixtureCreated = true;
  for (const file of ["ReviewPanel.tsx", "ReviewPanel.test.tsx", "events.ts", "meta.ts", "schema.ts", "responsive.css"]) {
    const source = await readFile(resolve(fixture, file), "utf8");
    await writeFile(resolve(target, file), source.replace("../../../src/registry/define-skeleton.ts", "../define-skeleton.ts"));
  }
  await build({
    configFile: resolve(web, "vite.config.ts"),
    root: web,
    build: { rollupOptions: { input: {
      contentFixture: resolve(web, "tests/browser/content-gallery.html"),
      conversationFixture: resolve(web, "tests/browser/conversation-gallery.html"),
      panelFixture: resolve(web, "tests/browser/panel-gallery.html"),
      shellFixture: resolve(web, "tests/browser/shell-gallery.html"),
    } } },
  });

  const html = await readFile(resolve(web, "dist/preview.html"), "utf8");
  const entry = html.match(/src="(?:\.\/|\/)assets\/(preview-[^"]+\.js)"/)?.[1];
  if (!html.includes("Skeleton preview") || !entry) throw new Error("Production preview page is missing its runtime bundle");

  const files = await readdir(assets);
  const skeletonChunks = [];
  for (const file of files.filter((name) => name.endsWith(".js"))) {
    if ((await readFile(resolve(assets, file), "utf8")).includes("synthetic Skeleton render failure")) skeletonChunks.push(file);
  }
  if (skeletonChunks.length !== 1) throw new Error("Fixture Skeleton must have its own production chunk");

  const reachable = new Set();
  const visit = async (file) => {
    if (reachable.has(file)) return;
    reachable.add(file);
    const code = await readFile(resolve(assets, file), "utf8");
    const imports = [...code.matchAll(/\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g)];
    for (const [, from, sideEffect] of imports) {
      const path = from ?? sideEffect;
      if (path.startsWith("./") && path.endsWith(".js")) await visit(path.slice(2));
    }
  };
  await visit(entry);
  if (reachable.has(skeletonChunks[0])) throw new Error("Preview entry statically imports the fixture Skeleton");
} finally {
  if (fixtureCreated) await rm(target, { recursive: true, force: true });
}
