import { entries } from "./entries";
import { validateRegistryEntries } from "./validate";
import type { SkeletonEntry } from "./define-skeleton.ts";
import { registryVersion } from "./version";

export type { SkeletonEntry } from "./define-skeleton";
export { defineSkeleton, defineSkeletonDefinition, skeletonMetaSchema } from "./define-skeleton";
export { registryVersion };

export function createRegistry(entries: readonly SkeletonEntry[], version: number) {
  if (!Number.isInteger(version) || version < 1) throw new Error("Registry version must be a positive integer");
  validateRegistryEntries(entries);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return {
    version,
    entries: byId as ReadonlyMap<string, SkeletonEntry>,
    getSkeleton: (id: string) => byId.get(id),
  };
}

export const registry = createRegistry(entries, registryVersion);
export const getSkeleton = (id: string) => registry.getSkeleton(id);
export { BrowserCaptureProvider, CaptureProvider, createValidatedCapture, getInputType, useCapture, recordingCapture } from "./capture";
export type { AppIdType, CaptureContextValue, CaptureRegistry, CaptureSink, CapturedEvent, EventName } from "./capture";
export { attachmentType, copyShare, isMeaningfulDraft, lengthBucket } from "./action-measurements";
export { SEEN_VISIBLE_RATIO, SEEN_VISIBLE_SECONDS, useSeen } from "./use-seen";
