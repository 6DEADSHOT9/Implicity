import { readdir, readFile } from "node:fs/promises";
import console from "node:console";
import process from "node:process";
import { relative, resolve } from "node:path";
import { URL } from "node:url";

const root = resolve(new URL("../src", import.meta.url).pathname);
const violations = [];

async function visit(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = resolve(path, entry.name);
    if (entry.isDirectory()) await visit(file);
    else if (/\.(?:[jt]sx?|mjs)$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name) && !file.endsWith("/registry/capture.tsx")) {
      const source = await readFile(file, "utf8");
      if (/posthog/i.test(source)) violations.push(relative(root, file));
    }
  }
}

await visit(root);
if (violations.length) {
  console.error(`PostHog is owned by registry/capture.tsx; found references in: ${violations.join(", ")}`);
  process.exitCode = 1;
}
