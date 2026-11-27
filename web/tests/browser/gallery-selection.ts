import type { SkeletonEntry } from "../../src/registry";

export function selectGalleryEntries(entries: readonly SkeletonEntry[], search: string) {
  const requested = new Set(new URLSearchParams(search).getAll("preview"));
  if (!requested.size) return entries;

  return entries.flatMap((entry) => {
    const galleryStates = entry.meta.galleryStates.filter(({ id }) => requested.has(`${entry.id} · ${id}`));
    if (!galleryStates.length) return [];
    const defaultStates = galleryStates.map(({ id }) => id);
    return [{ ...entry, meta: { ...entry.meta, galleryStates, defaultStates } }];
  });
}
