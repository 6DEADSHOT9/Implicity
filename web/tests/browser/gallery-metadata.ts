import type { SkeletonEntry } from "../../src/registry/define-skeleton";
import { selectGalleryEntries } from "./gallery-selection";

const modules = import.meta.glob<{ meta: SkeletonEntry["meta"] }>("../../src/registry/*/meta.ts", { eager: true });
const entries = Object.entries(modules).map(([path, { meta }]) => ({ id: path.split("/").at(-2)!, meta }))
  .sort((left, right) => left.id.localeCompare(right.id));

export function galleryRegistry(ids: ReadonlySet<string>, search: string) {
  const selected = selectGalleryEntries(entries.filter(({ id }) => ids.has(id)), search);
  return { entries: new Map(selected.map((entry) => [entry.id, entry])) };
}
