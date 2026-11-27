import { createElement, type ComponentType, type ReactNode } from "react";
import { z } from "zod";

export const skeletonMetaSchema = z.object({
  role: z.enum(["shell", "content", "panel", "home", "system"]),
  slots: z.array(z.string()),
  defaultStates: z.array(z.string()).min(1),
  commands: z.array(z.string()),
  limits: z.object({
    minWidth: z.number().positive(),
    minHeight: z.number().positive(),
    minContrast: z.number().min(4.5).max(21),
  }).strict(),
  galleryStates: z.array(z.object({
    id: z.string(),
    props: z.record(z.string(), z.unknown()),
    slots: z.record(z.string(), z.array(z.string())).optional(),
  }).strict()).min(1),
}).strict();

export type GalleryState = {
  id: string;
  props: Record<string, unknown>;
  slots?: Readonly<Record<string, readonly string[]>>;
};

export type SkeletonMeta = {
  role: "shell" | "content" | "panel" | "home" | "system";
  slots: readonly string[];
  defaultStates: readonly string[];
  commands: readonly string[];
  limits: { minWidth: number; minHeight: number; minContrast: number };
  galleryStates: readonly GalleryState[];
};
export type SkeletonEntry = {
  id: string;
  propsSchema: z.ZodObject<z.ZodRawShape>;
  slotsSchema: SlotsSchema;
  schema: z.ZodObject<{ props: z.ZodObject<z.ZodRawShape>; slots: SlotsSchema }>;
  events: readonly string[];
  meta: SkeletonMeta;
  Component: ComponentType<{ props: unknown; slots: Record<string, ReactNode>; onAction?: (action?: string, value?: string | number | boolean) => void; interactions?: Record<string, unknown> }>;
};

export type SlotsSchema = z.ZodObject<z.ZodRawShape> | z.ZodRecord<z.ZodString, z.ZodType>;

type ComponentProps<P extends z.ZodObject<z.ZodRawShape>, S extends SlotsSchema> = z.infer<P> & {
  slots?: Partial<Record<Extract<keyof z.infer<S>, string>, ReactNode[]>>;
  onAction?: (action?: string, value?: string | number | boolean) => void;
};
export type SkeletonDefinition<P extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>, S extends SlotsSchema = SlotsSchema> = {
  id: string;
  propsSchema: P;
  slotsSchema: S;
  schema: ReturnType<typeof createSkeletonSchema<P, S>>;
  events: readonly string[];
  meta: SkeletonMeta;
};

export function createSkeletonSchema<P extends z.ZodObject<z.ZodRawShape>, S extends SlotsSchema>(props: P, slots: S, namedPartProp?: string) {
  const slotSchema = slots instanceof z.ZodObject && !slots._def.catchall ? slots.strict() as S : slots;
  return z.object({ props: props.strict(), slots: slotSchema }).strict().superRefine((value, ctx) => {
    if (!namedPartProp) return;
    const { props: parsedProps, slots: parsedSlots } = value as { props: Record<string, unknown>; slots: Record<string, unknown> };
    const parts = parsedProps[namedPartProp];
    if (!Array.isArray(parts)) return;
    const ids = new Set(parts.map((part) => (part as { id?: unknown }).id));
    for (const slot of Object.keys(parsedSlots)) if (!ids.has(slot)) ctx.addIssue({ code: "custom", path: ["slots", slot], message: "Slot must match a named part" });
  });
}

export function defineSkeletonDefinition<P extends z.ZodObject<z.ZodRawShape>, S extends SlotsSchema>(entry: {
  id: string;
  props: P;
  slots: S;
  events: readonly string[];
  meta: SkeletonMeta;
  namedPartProp?: string;
}): SkeletonDefinition<P, S> {
  const propsSchema = entry.props.strict() as P;
  const slotsSchema = entry.slots instanceof z.ZodObject && !entry.slots._def.catchall ? entry.slots.strict() as S : entry.slots;
  const schema = createSkeletonSchema(propsSchema, slotsSchema, entry.namedPartProp);
  return { id: entry.id, propsSchema, slotsSchema, schema, events: entry.events, meta: entry.meta };
}

export function defineSkeleton<P extends z.ZodObject<z.ZodRawShape>, S extends SlotsSchema>(
  definition: SkeletonDefinition<P, S>,
  Skeleton: ComponentType<ComponentProps<P, S>>,
) {
  function Component({ props, slots, onAction, interactions }: { props: unknown; slots: Record<string, ReactNode>; onAction?: (action?: string, value?: string | number | boolean) => void; interactions?: Record<string, unknown> }) {
    const propsSchema = definition.propsSchema;
    const parsed = propsSchema.safeParse(props);
    if (!parsed.success) throw new Error("Skeleton props failed runtime validation");
    const slotArrays = Object.fromEntries(Object.entries(slots).map(([name, children]) => [name, Array.isArray(children) ? children : [children]]));
    const action = definition.id === "Nudge" && onAction ? () => onAction() : onAction;
    return createElement(Skeleton, { ...(parsed.data as ComponentProps<P, S>), ...interactions, slots: slotArrays as ComponentProps<P, S>["slots"], onAction: action } as ComponentProps<P, S>);
  }
  return {
    ...definition,
    Component,
  } satisfies SkeletonEntry;
}
