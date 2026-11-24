import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { registryVersion } from "../src/registry/version.ts";
import { createSkeletonSchema } from "../src/registry/define-skeleton.ts";
import { validateRegistryDefinitions } from "../src/registry/validate.ts";
import { checkGeneratedFileSet, checkRegistryVersion } from "../src/registry/snapshot.ts";

const check = process.argv.includes("--check");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const directory = resolve(root, "contracts/generated/components");
const manifestPath = resolve(directory, "registry.json");
const sourceDirectory = resolve(root, "web/src/registry");
const folderNames = (await readdir(sourceDirectory, { withFileTypes: true }))
  .filter((item) => item.isDirectory())
  .map((item) => item.name)
  .sort();
const entries = [];
for (const id of folderNames) {
  const folder = resolve(sourceDirectory, id);
  const expected = ["component.tsx", `${id}.test.tsx`, "schema.ts", "events.ts", "meta.ts"];
  const files = await readdir(folder);
  const missing = expected.filter((file) => !files.includes(file));
  if (missing.length) throw new Error(`${id} registry entry is missing: ${missing.join(", ")}`);
  const [schemas, events, meta] = await Promise.all([
    import(join(folder, "schema.ts")),
    import(join(folder, "events.ts")),
    import(join(folder, "meta.ts")),
  ]);
  entries.push({
    id,
    propsSchema: schemas.propsSchema,
    slotsSchema: schemas.slotsSchema,
    schema: createSkeletonSchema(schemas.propsSchema, schemas.slotsSchema),
    events: events.events,
    meta: meta.meta,
  });
}
const snapshot = { registry_version: registryVersion, components: entries.map(({ id }) => id).sort() };
validateRegistryDefinitions(entries);

let previous;
try {
  previous = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
checkRegistryVersion(previous, snapshot);

const artifacts = new Map(entries.map((entry) => [`${entry.id}.schema.json`, `${JSON.stringify(entry.schema.toJSONSchema(), null, 2)}\n`]));
artifacts.set("registry.json", `${JSON.stringify(snapshot, null, 2)}\n`);
const actualFiles = await readdir(directory).catch((error) => error.code === "ENOENT" ? [] : Promise.reject(error));
const generatedFiles = actualFiles.filter((name) => name === "registry.json" || name.endsWith(".schema.json"));

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
