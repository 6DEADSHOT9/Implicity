import type { ComponentType, ReactNode } from "react";
import type { z } from "zod";
import { defineSkeleton, defineSkeletonDefinition, type SkeletonEntry } from "./registry/define-skeleton";
import { discoverRegistryFolders, registryFoldersFromPaths } from "./registry/discovery";
import { validateRegistryDefinitions } from "./registry/validate";

const components = import.meta.glob<Record<string, ComponentType<never>>>(["./registry/*/*.tsx", "!**/*.test.tsx"]);
const schemas = import.meta.glob<{ propsSchema: z.ZodObject<z.ZodRawShape>; slotsSchema: z.ZodObject<z.ZodRawShape> }>("./registry/*/schema.ts");
const eventModules = import.meta.glob<{ events: readonly string[] }>("./registry/*/events.ts");
const metaModules = import.meta.glob<{ meta: SkeletonEntry["meta"] }>("./registry/*/meta.ts");
const testPaths = Object.keys(import.meta.glob("./registry/*/*.test.tsx"));
const modulePaths = [...Object.keys(components), ...Object.keys(schemas), ...Object.keys(eventModules), ...Object.keys(metaModules), ...testPaths];

export async function loadPreviewEntry(id: string): Promise<SkeletonEntry | undefined> {
  const componentPath = `./registry/${id}/${id}.tsx`;
  if (!Object.hasOwn(components, componentPath)) return undefined;
  const schemaPath = `./registry/${id}/schema.ts`;
  const eventPath = `./registry/${id}/events.ts`;
  const metaPath = `./registry/${id}/meta.ts`;
  const [component, schema, events, metadata] = await Promise.all([
    components[componentPath](), schemas[schemaPath]?.(), eventModules[eventPath]?.(), metaModules[metaPath]?.(),
  ]);
  const folder = registryFoldersFromPaths(modulePaths, "./registry/").find((item) => item.id === id)!;
  const [{ definition }] = discoverRegistryFolders([{
    id,
    files: folder.files,
    componentExports: Object.keys(component),
    schema,
    events,
    metadata,
  }]);
  validateRegistryDefinitions([definition]);
  return defineSkeleton(definition, component[id] as ComponentType<z.infer<typeof definition.propsSchema> & { slots?: Partial<Record<Extract<keyof z.infer<typeof definition.slotsSchema>, string>, ReactNode[]>> }>);
}
