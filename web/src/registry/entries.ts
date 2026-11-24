import type { SkeletonEntry } from "./define-skeleton.ts";

const modules = import.meta.glob<{ entry: SkeletonEntry }>("./*/component.tsx", { eager: true });

export const entries = Object.entries(modules)
  .map(([path, module]) => {
    const [, folder] = path.match(/^\.\/([^/]+)\/component\.tsx$/)!;
    if (module.entry.id !== folder) {
      throw new Error(`Skeleton folder, file and id must match: ${path}`);
    }
    return module.entry;
  });
