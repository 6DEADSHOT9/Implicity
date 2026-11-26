import type { ComponentType, ReactNode } from "react";
import type { z } from "zod";
import { defineSkeleton } from "./define-skeleton.ts";
import { discoverRegistryFolders, registryFoldersFromPaths } from "./discovery.ts";
import type { SkeletonEntry, SlotsSchema } from "./define-skeleton.ts";

const components = import.meta.glob<Record<string, ComponentType<never>>>(["./*/*.tsx", "!**/*.test.tsx"], { eager: true });
const schemas = import.meta.glob<{ propsSchema: z.ZodObject<z.ZodRawShape>; slotsSchema: SlotsSchema }>("./*/schema.ts", { eager: true });
const eventModules = import.meta.glob<{ events: readonly string[] }>("./*/events.ts", { eager: true });
const metaModules = import.meta.glob<{ meta: SkeletonEntry["meta"] }>("./*/meta.ts", { eager: true });
const testPaths = Object.keys(import.meta.glob("./*/*.test.tsx"));
const modulePaths = [...Object.keys(components), ...Object.keys(schemas), ...Object.keys(eventModules), ...Object.keys(metaModules), ...testPaths];
const discovered = discoverRegistryFolders(registryFoldersFromPaths(modulePaths).map(({ id, files }) => {
  const componentPath = `./${id}/${id}.tsx`;
  const schemaPath = `./${id}/schema.ts`;
  const eventPath = `./${id}/events.ts`;
  const metaPath = `./${id}/meta.ts`;
  return {
    id,
    files,
    componentExports: Object.keys(components[componentPath] ?? {}),
    schema: schemas[schemaPath],
    events: eventModules[eventPath],
    metadata: metaModules[metaPath],
  };
}));

export const entries: readonly SkeletonEntry[] = discovered.map(({ id, definition }) => {
  const component = components[`./${id}/${id}.tsx`]?.[id];
  if (!component) throw new Error(`${id} registry entry is missing named component export ${id}`);
  return defineSkeleton(definition, component as ComponentType<z.infer<typeof definition.propsSchema> & { slots?: Partial<Record<Extract<keyof z.infer<typeof definition.slotsSchema>, string>, ReactNode[]>> }>);
});
