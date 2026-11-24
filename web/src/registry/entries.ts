import type { ComponentType, ReactNode } from "react";
import { defineSkeleton, defineSkeletonDefinition, type SkeletonEntry } from "./define-skeleton.ts";
import type { z } from "zod";

const components = import.meta.glob<Record<string, ComponentType<never>>>(["./*/*.tsx", "!**/*.test.tsx"], { eager: true });
const schemas = import.meta.glob<{ propsSchema: z.ZodObject<z.ZodRawShape>; slotsSchema: z.ZodObject<z.ZodRawShape> }>("./*/schema.ts", { eager: true });
const eventModules = import.meta.glob<{ events: readonly string[] }>("./*/events.ts", { eager: true });
const metaModules = import.meta.glob<{ meta: SkeletonEntry["meta"] }>("./*/meta.ts", { eager: true });
const folders = new Set([...Object.keys(components), ...Object.keys(schemas), ...Object.keys(eventModules), ...Object.keys(metaModules)]
  .map((path) => path.split("/")[1]));

export const entries: readonly SkeletonEntry[] = [...folders].sort().map((folder) => {
  const path = `./${folder}/${folder}.tsx`;
  const component = components[path]?.[folder];
  const schema = schemas[`./${folder}/schema.ts`];
  const events = eventModules[`./${folder}/events.ts`]?.events;
  const meta = metaModules[`./${folder}/meta.ts`]?.meta;
  if (!component || !schema?.propsSchema || !schema.slotsSchema || !events || !meta) {
    throw new Error(`${folder} registry entry requires named ${folder} export, schema.ts, events.ts and meta.ts`);
  }
  const definition = defineSkeletonDefinition({ id: folder, props: schema.propsSchema, slots: schema.slotsSchema, events, meta });
  return defineSkeleton(definition, component as ComponentType<z.infer<typeof schema.propsSchema> & { slots?: Partial<Record<Extract<keyof z.infer<typeof schema.slotsSchema>, string>, ReactNode[]>> }>);
});
