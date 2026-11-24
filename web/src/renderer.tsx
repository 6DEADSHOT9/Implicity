import { defineCatalog } from "@json-render/core";
import { JSONUIProvider, Renderer, defineRegistry } from "@json-render/react";
import { schema as jsonRenderSchema } from "@json-render/react/schema";
import type { ReactElement } from "react";
import { z } from "zod";
import type { Spec } from "./contracts/generated";
import { baselineLayout, getSkeleton, registry, registryVersion } from "./registry";

const elementSchema = z.object({
  type: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/),
  props: z.record(z.string(), z.unknown()),
  slots: z.record(z.string(), z.array(z.string())).optional(),
}).strict();
const specSchema = z.object({
  registry_version: z.number().int().positive(),
  root: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
  elements: z.record(z.string(), elementSchema),
}).strict();

const catalog = defineCatalog(jsonRenderSchema, {
  components: { TextBlock: { props: registry.TextBlock.schema.shape.props, slots: [] } },
  actions: {},
});
const { registry: renderRegistry } = defineRegistry(catalog, {
  components: { TextBlock: ({ props }) => <registry.TextBlock.Component {...props} /> },
});

function validSpec(spec: unknown): spec is Spec {
  const parsed = specSchema.safeParse(spec);
  if (!parsed.success || parsed.data.registry_version !== registryVersion || !(parsed.data.root in parsed.data.elements)) return false;

  return Object.values(parsed.data.elements).every((element) => {
    const skeleton = getSkeleton(element.type);
    if (!skeleton || !skeleton.schema.shape.props.safeParse(element.props).success) return false;
    const slots = element.slots ?? {};
    return Object.keys(slots).every((slot) => (skeleton.meta.slots as readonly string[]).includes(slot))
      && Object.values(slots).flat().every((child) => child in parsed.data.elements);
  });
}

export function resolveLayout(candidate: unknown, lastGood: unknown): Spec {
  if (validSpec(candidate)) return candidate;
  if (validSpec(lastGood)) return lastGood;
  return baselineLayout;
}

export function renderMessage(spec: unknown, plainText: string): ReactElement {
  const parsed = specSchema.safeParse(spec);
  if (!parsed.success || parsed.data.registry_version !== registryVersion || !(parsed.data.root in parsed.data.elements)) {
    return <p style={{ color: "var(--foreground)" }}>{plainText}</p>;
  }

  const elements = Object.fromEntries(Object.entries(parsed.data.elements).map(([id, element]) => {
    const skeleton = getSkeleton(element.type);
    const slots = element.slots ?? {};
    const valid = skeleton
      && skeleton.schema.shape.props.safeParse(element.props).success
      && Object.keys(slots).every((slot) => (skeleton.meta.slots as readonly string[]).includes(slot))
      && Object.values(slots).flat().every((child) => child in parsed.data.elements);
    return [id, valid ? element : { type: "TextBlock", props: { text: plainText } }];
  }));

  return <JSONUIProvider registry={renderRegistry}>
    <Renderer spec={{ ...parsed.data, elements } as never} registry={renderRegistry} />
  </JSONUIProvider>;
}
