import type { SkeletonEntry } from "../../src/registry";

type GalleryEntry = Pick<SkeletonEntry, "id" | "meta">;

export function selectGalleryEntries<T extends GalleryEntry>(entries: readonly T[], search: string): readonly T[] {
  const requested = new Set(new URLSearchParams(search).getAll("preview"));
  if (!requested.size) return entries;

  return entries.flatMap((entry) => {
    const galleryStates = entry.meta.galleryStates.filter(({ id }) => requested.has(`${entry.id} · ${id}`));
    if (!galleryStates.length) return [];
    const defaultStates = galleryStates.map(({ id }) => id);
    return [{ ...entry, meta: { ...entry.meta, galleryStates, defaultStates } }];
  });
}
