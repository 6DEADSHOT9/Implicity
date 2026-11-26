import { defineSkeletonDefinition, type SkeletonDefinition, type SkeletonEntry, type SlotsSchema } from "./define-skeleton.ts";

export type RegistryFolderModules = {
  id: string;
  files: readonly string[];
  componentExports: readonly string[];
  schema?: { propsSchema?: SkeletonDefinition["propsSchema"]; slotsSchema?: SlotsSchema };
  events?: { events?: readonly string[] };
  metadata?: { meta?: SkeletonEntry["meta"] };
};

export type DiscoveredSkeleton = {
  id: string;
  definition: SkeletonDefinition;
};

export function registryFoldersFromPaths(paths: readonly string[], prefix = "./"): { id: string; files: string[] }[] {
  const ids = [...new Set(paths.map((path) => path.slice(prefix.length).split("/")[0]))].sort();
  return ids.map((id) => ({ id, files: paths.filter((path) => path.startsWith(`${prefix}${id}/`)).map((path) => path.slice(path.lastIndexOf("/") + 1)) }));
}

export function discoverRegistryFolders(folders: readonly RegistryFolderModules[]): DiscoveredSkeleton[] {
  return [...folders].sort((left, right) => left.id.localeCompare(right.id)).map(({ id, files, componentExports, schema, events, metadata }) => {
    const expected = [`${id}.tsx`, `${id}.test.tsx`, "schema.ts", "events.ts", "meta.ts"];
    const missing = expected.filter((file) => !files.includes(file));
    if (missing.length) throw new Error(`${id} registry entry is missing: ${missing.join(", ")}`);
    if (!componentExports.includes(id)) throw new Error(`${id} registry entry is missing named component export ${id}`);
    if (!schema?.propsSchema || !schema.slotsSchema) throw new Error(`${id} registry entry schema.ts must export propsSchema and slotsSchema`);
    if (!events?.events) throw new Error(`${id} registry entry events.ts must export events`);
    if (!metadata?.meta) throw new Error(`${id} registry entry meta.ts must export meta`);
    return { id, definition: defineSkeletonDefinition({ id, props: schema.propsSchema, slots: schema.slotsSchema, events: events.events, meta: metadata.meta }) };
  });
}
