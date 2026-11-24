import type { SkeletonEntry, SkeletonDefinition } from "./define-skeleton.ts";

const components = import.meta.glob<{ entry: SkeletonEntry }>(["./*/*.tsx", "!**/*.test.tsx"], { eager: true });
const definitions = import.meta.glob<{ definition: SkeletonDefinition }>("./*/schema.ts", { eager: true });

export const entries: readonly SkeletonEntry[] = Object.entries(components)
  .flatMap(([path, module]) => {
    const [, folder, file] = path.match(/^\.\/([^/]+)\/([^/]+)\.tsx$/)!;
    if (file !== folder) return [];
    const definition = definitions[`./${folder}/schema.ts`]?.definition;
    const entry = module.entry;
    if (definition?.id !== folder || entry?.id !== folder
      || entry.propsSchema !== definition.propsSchema
      || entry.slotsSchema !== definition.slotsSchema
      || entry.schema !== definition.schema
      || entry.events !== definition.events
      || entry.meta !== definition.meta) {
      throw new Error(`Skeleton folder, file, schema and export must match: ${path}`);
    }
    return [entry];
  });
