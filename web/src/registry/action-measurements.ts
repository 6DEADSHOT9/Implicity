import actions from "../../../contracts/actions.json" with { type: "json" };

type LengthGroup = keyof typeof actions.length_cutoffs;

export function lengthBucket(length: number, group: LengthGroup): "short" | "medium" | "long" {
  const { medium, long } = actions.length_cutoffs[group];
  return length < medium ? "short" : length < long ? "medium" : "long";
}

export function copyShare(copiedCharacters: number, sourceCharacters: number): "some" | "most" | "all" {
  if (sourceCharacters <= 0 || copiedCharacters >= sourceCharacters) return "all";
  return copiedCharacters / sourceCharacters < actions.copy_share_half_threshold ? "some" : "most";
}

export function isMeaningfulDraft(length: number): boolean {
  return length >= actions.meaningful_draft_characters;
}

export function attachmentType(mediaType: string): "image" | "document" | "audio" | "video" | "other" {
  if (mediaType.startsWith("image/")) return "image";
  if (mediaType.startsWith("audio/")) return "audio";
  if (mediaType.startsWith("video/")) return "video";
  if (mediaType.startsWith("application/") || mediaType.startsWith("text/")) return "document";
  return "other";
}
