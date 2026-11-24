import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ignoredColors = new Set(["inherit", "initial", "unset", "currentcolor", "transparent"]);
const namedColors = "aliceblue|aqua|black|blue|fuchsia|gray|green|lime|maroon|navy|olive|orange|purple|red|silver|teal|white|yellow";
const patterns = [
  [/#(?:[\da-f]{3,8})\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\s*\(/i, "fixed color"],
  [new RegExp(`(?:color|background(?:-color|Color)?|border-(?:color|Color))\\s*:\\s*["']?(?:${namedColors})\\b`, "i"), "named color"],
  [/(?:fontFamily|font-family)\s*:\s*["'][^"']+["']/i, "fixed font"],
  [/(?:fontSize|font-size|fontFamily|font-family|width|height|minWidth|minHeight|min-width|min-height|padding|margin|gap|borderRadius|border-radius)\s*:\s*["']?\d+(?:\.\d+)?(?:px|rem|em|pt|%)?\b/i, "fixed size or font"],
  [/\b(?:text|bg|border)-[a-z]+-\d{2,3}\b|\btext-(?:xs|sm|base|lg|[2-9]?xl)\b|\b(?:w|h|min-w|max-w|min-h|max-h|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y)-\d+\b|\b(?:text|w|h|min-w|max-w|min-h|max-h|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y)-\[(?:\d|#)[^\]]+\]|\bfont-(?:serif|mono|sans|\[[^\]]+\])\b/i, "fixed utility color, size or font"],
];

/** @param {string} source @returns {string[]} */
export function tokenStyleViolations(source) {
  return patterns.flatMap(([pattern, label]) => [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))]
    .filter(([match]) => !ignoredColors.has(match.toLowerCase()))
    .map(([match]) => `${label}: ${match}`));
}

async function sourceFiles(path) {
  const files = [];
  for (const name of await readdir(path, { withFileTypes: true })) {
    const fullPath = resolve(path, name.name);
    if (name.isDirectory()) files.push(...await sourceFiles(fullPath));
    else if (/\.(?:tsx|css)$/.test(name.name) && !name.name.endsWith(".test.tsx")) files.push(fullPath);
  }
  return files;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const paths = [...await sourceFiles(resolve(root, "web/src/registry")), resolve(root, "web/src/renderer.tsx")];
let failed = false;
for (const path of paths) {
  const violations = tokenStyleViolations(await readFile(path, "utf8"));
  if (violations.length) {
    failed = true;
    for (const violation of violations) process.stderr.write(`${path}: ${violation}\n`);
  }
}
if (failed) process.exitCode = 1;
