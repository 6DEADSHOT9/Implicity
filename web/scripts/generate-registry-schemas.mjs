import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { registryVersion } from "../src/registry/version.ts";
import { validateRegistryDefinitions } from "../src/registry/validate.ts";
import { checkGeneratedFileSet, checkRegistrySnapshots } from "../src/registry/snapshot.ts";
import { discoverRegistryFolders } from "../src/registry/discovery.ts";

const check = process.argv.includes("--check");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const directory = resolve(root, "contracts/generated/components");
const sourceDirectory = resolve(root, "web/src/registry");
const folderNames = await Promise.all((await readdir(sourceDirectory, { withFileTypes: true }))
  .filter((item) => item.isDirectory())
  .map(async ({ name }) => ({ name, files: await readdir(resolve(sourceDirectory, name)) })));
const foldersToDiscover = folderNames.filter(({ files }) => files.some((file) => file.endsWith(".tsx") || ["schema.ts", "events.ts", "meta.ts"].includes(file)));
const entries = [];
function namedValueExports(source, filename) {
  const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set();
  for (const statement of parsed.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) ?? [] : [];
    if (modifiers.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword) && !modifiers.some(({ kind }) => kind === ts.SyntaxKind.DefaultKeyword || kind === ts.SyntaxKind.DeclareKeyword)) {
      if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) && statement.name) names.add(statement.name.text);
      if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
    }
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) if (!element.isTypeOnly) names.add(element.name.text);
    }
  }
  return [...names];
}
const folders = await Promise.all(foldersToDiscover.map(async ({ name: id }) => {
  const folder = resolve(sourceDirectory, id);
  const files = await readdir(folder);
  if (![`${id}.tsx`, "schema.ts", "events.ts", "meta.ts"].every((file) => files.includes(file))) return { id, files, componentExports: [] };
  const [componentSource, schema, events, metadata] = await Promise.all([
    readFile(join(folder, `${id}.tsx`), "utf8"),
    import(join(folder, "schema.ts")),
    import(join(folder, "events.ts")),
    import(join(folder, "meta.ts")),
  ]);
  return { id, files, componentExports: namedValueExports(componentSource, join(folder, `${id}.tsx`)), schema, events, metadata };
}));
entries.push(...discoverRegistryFolders(folders).map(({ definition }) => definition));
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
const typeCheckPath = resolve(sourceDirectory, "registry-props-typecheck.ts");
const typeCheckSource = entries.length ? [
  'import { defineSkeleton, defineSkeletonDefinition } from "./define-skeleton.ts";',
  ...entries.flatMap(({ id }) => [
    `import { ${id} as ${id}Component } from "./${id}/${id}.tsx";`,
    `import { propsSchema as ${id}Props, slotsSchema as ${id}Slots } from "./${id}/schema.ts";`,
    `import { events as ${id}Events } from "./${id}/events.ts";`,
    `import { meta as ${id}Meta } from "./${id}/meta.ts";`,
    `defineSkeleton(defineSkeletonDefinition({ id: "${id}", props: ${id}Props, slots: ${id}Slots, events: ${id}Events, meta: ${id}Meta }), ${id}Component);`,
  ]),
].join("\n") + "\n" : "export {};\n";
const actualFiles = await readdir(directory).catch((error) => error.code === "ENOENT" ? [] : Promise.reject(error));
const generatedFiles = actualFiles.filter((name) => name === "registry.json" || /^registry-v\d+\.json$/.test(name) || name.endsWith(".schema.json"));

if (check) {
  checkGeneratedFileSet([...artifacts.keys()], generatedFiles);
  for (const [name, contents] of artifacts) {
    if (await readFile(resolve(directory, name), "utf8") !== contents) throw new Error(`${name} is stale; run make registry-generate`);
  }
  if (await readFile(typeCheckPath, "utf8").catch(() => undefined) !== typeCheckSource) throw new Error("registry-props-typecheck.ts is stale; run make registry-generate");
} else {
  await mkdir(directory, { recursive: true });
  for (const stale of generatedFiles.filter((name) => !artifacts.has(name))) await rm(resolve(directory, stale));
  for (const [name, contents] of artifacts) await writeFile(resolve(directory, name), contents);
  await writeFile(typeCheckPath, typeCheckSource);
}
