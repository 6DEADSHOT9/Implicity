import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { registryVersion } from "../src/registry/version.ts";
import { validateRegistryDefinitions } from "../src/registry/validate.ts";
import { checkGeneratedFileSet, checkRegistryVersion, checkRegistryVersionSnapshot } from "../src/registry/snapshot.ts";

const check = process.argv.includes("--check");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const directory = resolve(root, "contracts/generated/components");
const sourceDirectory = resolve(root, "web/src/registry");
const folderNames = (await readdir(sourceDirectory, { withFileTypes: true }))
  .filter((item) => item.isDirectory())
  .map((item) => item.name)
  .sort();
const entries = [];
for (const id of folderNames) {
  const folder = resolve(sourceDirectory, id);
  const expected = [`${id}.tsx`, `${id}.test.tsx`, "schema.ts", "events.ts", "meta.ts"];
  const files = await readdir(folder);
  const missing = expected.filter((file) => !files.includes(file));
  if (missing.length) throw new Error(`${id} registry entry is missing: ${missing.join(", ")}`);
  const { definition } = await import(join(folder, "schema.ts"));
  if (definition.id !== id) throw new Error(`${id} schema declaration has a different id`);
  entries.push(definition);
}
const snapshot = { registry_version: registryVersion, components: entries.map(({ id }) => id).sort() };
validateRegistryDefinitions(entries);

const { execFileSync } = await import("node:child_process");
const validRefs = new Map();
const hasRef = (ref) => {
  if (!validRefs.has(ref)) {
    try {
      execFileSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], { cwd: root, stdio: "ignore" });
      validRefs.set(ref, true);
    } catch {
      validRefs.set(ref, false);
    }
  }
  return validRefs.get(ref);
};
const gitFile = (ref, path) => {
  if (!hasRef(ref)) return undefined;
  const found = execFileSync("git", ["ls-tree", "-r", "--name-only", ref, path], { cwd: root, encoding: "utf8" }).trim();
  return found ? JSON.parse(execFileSync("git", ["show", `${ref}:${path}`], { cwd: root, encoding: "utf8" })) : undefined;
};
const previous = gitFile("HEAD", "contracts/generated/components/registry.json");
const baseRef = `origin/${process.env.GITHUB_BASE_REF || "main"}`;
const committedVersionSnapshot = gitFile("HEAD", `contracts/generated/components/registry-v${registryVersion}.json`);
const baseSnapshot = gitFile(baseRef, "contracts/generated/components/registry.json")
  ?? committedVersionSnapshot
  ?? previous
  ?? { registry_version: snapshot.registry_version, components: [] };
checkRegistryVersion(baseSnapshot, snapshot);
checkRegistryVersion(previous, snapshot);
const historyFiles = execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD", "contracts/generated/components"], { cwd: root, encoding: "utf8" })
  .trim().split("\n").filter((path) => /\/registry-v\d+\.json$/.test(path));
const artifacts = new Map(entries.map((entry) => [`${entry.id}.schema.json`, `${JSON.stringify(entry.schema.toJSONSchema(), null, 2)}\n`]));
for (const path of historyFiles) {
  const historical = gitFile("HEAD", path);
  const version = Number(path.match(/registry-v(\d+)\.json$/)?.[1]);
  if (historical.registry_version !== version) throw new Error(`${path} has an invalid registry version`);
  if (version === registryVersion) checkRegistryVersionSnapshot(historical, snapshot);
  artifacts.set(path.slice(path.lastIndexOf("/") + 1), `${JSON.stringify(historical, null, 2)}\n`);
}
artifacts.set("registry.json", `${JSON.stringify(snapshot, null, 2)}\n`);
if (!historyFiles.some((path) => path.endsWith(`/registry-v${registryVersion}.json`))) {
  artifacts.set(`registry-v${registryVersion}.json`, `${JSON.stringify(snapshot, null, 2)}\n`);
}
const actualFiles = await readdir(directory).catch((error) => error.code === "ENOENT" ? [] : Promise.reject(error));
const generatedFiles = actualFiles.filter((name) => name === "registry.json" || /^registry-v\d+\.json$/.test(name) || name.endsWith(".schema.json"));

if (check) {
  checkGeneratedFileSet([...artifacts.keys()], generatedFiles);
  for (const [name, contents] of artifacts) {
    if (await readFile(resolve(directory, name), "utf8") !== contents) throw new Error(`${name} is stale; run make registry-generate`);
  }
} else {
  await mkdir(directory, { recursive: true });
  for (const stale of generatedFiles.filter((name) => !artifacts.has(name))) await rm(resolve(directory, stale));
  for (const [name, contents] of artifacts) await writeFile(resolve(directory, name), contents);
}
