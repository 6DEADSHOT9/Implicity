import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../scripts/check-capture-boundary.mjs", import.meta.url));
let root: string | undefined;

/** A copy of web/ with the boundary script, in a directory whose path has a space. */
function webCopy(files: Record<string, string>) {
  root = mkdtempSync(join(tmpdir(), "capture boundary "));
  mkdirSync(join(root, "scripts"));
  copyFileSync(script, join(root, "scripts", "check-capture-boundary.mjs"));
  for (const [path, source] of Object.entries(files)) {
    mkdirSync(join(root, "src", path, ".."), { recursive: true });
    writeFileSync(join(root, "src", path), source);
  }
  return spawnSync(process.execPath, [join(root, "scripts", "check-capture-boundary.mjs")], { encoding: "utf8" });
}

afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = undefined; });

describe("capture boundary check", () => {
  it("passes in a path with a space when only the capture wrapper names PostHog", () => {
    const result = webCopy({ "registry/capture.tsx": 'import("posthog-js");', "registry/Details/Details.tsx": "export {};" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("fails in a path with a space when a skeleton imports posthog-js", () => {
    const result = webCopy({ "registry/capture.tsx": 'import("posthog-js");', "registry/Details/Details.tsx": 'import posthog from "posthog-js";' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("registry/Details/Details.tsx");
  });
});
