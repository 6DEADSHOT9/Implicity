import type { ComponentType } from "react";
import { TextBlock } from "./TextBlock/TextBlock";
import { entries } from "./entries";

export const registryVersion = 1;
export const registry = {
  TextBlock: { ...entries.TextBlock, Component: TextBlock },
} satisfies Record<string, typeof entries[keyof typeof entries] & { Component: ComponentType<{ text: string }> }>;

export const baselineLayout = {
  registry_version: registryVersion,
  root: "baseline",
  elements: { baseline: { type: "TextBlock", props: { text: "" } } },
};

export function getSkeleton(id: string) {
  return registry[id as keyof typeof registry];
}
