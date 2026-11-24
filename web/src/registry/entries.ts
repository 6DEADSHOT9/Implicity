import { defineSkeleton, type SkeletonEntry, type SkeletonDefinition } from "./define-skeleton.ts";
import type { ComponentType } from "react";

const components = import.meta.glob<Record<string, ComponentType<never>>>(["./*/*.tsx", "!**/*.test.tsx"], { eager: true });
const definitions = import.meta.glob<{ definition: SkeletonDefinition }>("./*/schema.ts", { eager: true });

export const entries: readonly SkeletonEntry[] = Object.entries(components)
  .flatMap(([path, module]) => {
    const [, folder, file] = path.match(/^\.\/([^/]+)\/([^/]+)\.tsx$/)!;
    if (file !== folder) return [];
    const definition = definitions[`./${folder}/schema.ts`]?.definition;
    const Skeleton = module[folder];
    if (definition?.id !== folder || typeof Skeleton !== "function") {
      throw new Error(`Skeleton folder, file, schema and export must match: ${path}`);
    }
    return [defineSkeleton(definition, Skeleton) as SkeletonEntry];
  });
