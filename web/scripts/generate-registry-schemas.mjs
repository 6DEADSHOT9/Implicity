import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { registryVersion } from "../src/registry/version.ts";
import { validateRegistryDefinitions } from "../src/registry/validate.ts";
import { checkGeneratedFileSet, checkRegistrySnapshots } from "../src/registry/snapshot.ts";
import { defineSkeletonDefinition } from "../src/registry/define-skeleton.ts";

const check = process.argv.includes("--check");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const directory = resolve(root, "contracts/generated/components");
const sourceDirectory = resolve(root, "web/src/registry");
const folderNames = (await readdir(sourceDirectory, { withFileTypes: true }))
  .filter((item) => item.isDirectory())
  .map((item) => item.name)
  .sort();
const entries = [];
function exportsNamed(source, name, filename) {
  const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return parsed.statements.some((statement) => {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name && statement.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword)) return true;
    if (ts.isVariableStatement(statement) && statement.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword)
      && statement.declarationList.declarations.some((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name)) return true;
    return false;
  });
}
for (const id of folderNames) {
  const folder = resolve(sourceDirectory, id);
  const expected = [`${id}.tsx`, `${id}.test.tsx`, "schema.ts", "events.ts", "meta.ts"];
  const files = await readdir(folder);
  const missing = expected.filter((file) => !files.includes(file));
  if (missing.length) throw new Error(`${id} registry entry is missing: ${missing.join(", ")}`);
  const [componentSource, schema, eventModule, metaModule] = await Promise.all([
    readFile(join(folder, `${id}.tsx`), "utf8"),
    import(join(folder, "schema.ts")),
    import(join(folder, "events.ts")),
    import(join(folder, "meta.ts")),
  ]);
  if (!exportsNamed(componentSource, id, join(folder, `${id}.tsx`))) throw new Error(`${id} registry entry is missing named component export ${id}`);
  if (!schema.propsSchema || !schema.slotsSchema) throw new Error(`${id} registry entry schema.ts must export propsSchema and slotsSchema`);
  if (!eventModule.events) throw new Error(`${id} registry entry events.ts must export events`);
  if (!metaModule.meta) throw new Error(`${id} registry entry meta.ts must export meta`);
  entries.push(defineSkeletonDefinition({ id, props: schema.propsSchema, slots: schema.slotsSchema, events: eventModule.events, meta: metaModule.meta }));
}
const snapshot = { registry_version: registryVersion, components: entries.map(({ id }) => id).sort() };
validateRegistryDefinitions(entries);

const historyFiles = (await readdir(directory).catch((error) => error.code === "ENOENT" ? [] : Promise.reject(error)))
  .filter((name) => /^registry-v\d+\.json$/.test(name));
let snapshots = await Promise.all(historyFiles.map(async (name) => {
  const value = JSON.parse(await readFile(resolve(directory, name), "utf8"));
  const version = Number(name.match(/^registry-v(\d+)\.json$/)[1]);
  if (value.registry_version !== version) throw new Error(`${name} has an invalid registry version`);
  return value;
}));
const highestVersion = Math.max(0, ...snapshots.map(({ registry_version }) => registry_version));
if (!check && registryVersion === highestVersion + 1) {
  const path = resolve(directory, `registry-v${registryVersion}.json`);
  await mkdir(directory, { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`);
  snapshots = [...snapshots, snapshot];
}
checkRegistrySnapshots(snapshots, snapshot);
const artifacts = new Map(entries.map((entry) => [`${entry.id}.schema.json`, `${JSON.stringify(entry.schema.toJSONSchema(), null, 2)}\n`]));
for (const historical of snapshots) artifacts.set(`registry-v${historical.registry_version}.json`, `${JSON.stringify(historical, null, 2)}\n`);
artifacts.set("registry.json", `${JSON.stringify(snapshot, null, 2)}\n`);
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
