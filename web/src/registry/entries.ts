import type { ComponentType, ReactNode } from "react";
import type { z } from "zod";
import { defineSkeleton } from "./define-skeleton.ts";
import { discoverRegistryFolders } from "./discovery.ts";
import type { SkeletonEntry } from "./define-skeleton.ts";

const components = import.meta.glob<Record<string, ComponentType<never>>>(["./*/*.tsx", "!**/*.test.tsx"], { eager: true });
const schemas = import.meta.glob<{ propsSchema: z.ZodObject<z.ZodRawShape>; slotsSchema: z.ZodObject<z.ZodRawShape> }>("./*/schema.ts", { eager: true });
const eventModules = import.meta.glob<{ events: readonly string[] }>("./*/events.ts", { eager: true });
const metaModules = import.meta.glob<{ meta: SkeletonEntry["meta"] }>("./*/meta.ts", { eager: true });
const tests = import.meta.glob("./*/*.test.tsx");
const modulePaths = [...Object.keys(components), ...Object.keys(schemas), ...Object.keys(eventModules), ...Object.keys(metaModules), ...Object.keys(tests)];
const folders = [...new Set(modulePaths.map((path) => path.split("/")[1]))].sort();
const discovered = discoverRegistryFolders(folders.map((id) => {
  const componentPath = `./${id}/${id}.tsx`;
  const schemaPath = `./${id}/schema.ts`;
  const eventPath = `./${id}/events.ts`;
  const metaPath = `./${id}/meta.ts`;
  const moduleFiles = modulePaths.filter((path) => path.startsWith(`./${id}/`)).map((path) => path.slice(path.lastIndexOf("/") + 1));
  return {
    id,
    files: moduleFiles,
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
