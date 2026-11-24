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
  galleryStates: z.array(z.string()).min(1),
}).strict();

export type SkeletonMeta = {
  role: "shell" | "content" | "panel" | "home" | "system";
  slots: readonly string[];
  defaultStates: readonly string[];
  commands: readonly string[];
  limits: { minWidth: number; minHeight: number; minContrast: number };
  galleryStates: readonly string[];
};
export type SkeletonEntry = {
  id: string;
  propsSchema: z.ZodObject<z.ZodRawShape>;
  slotsSchema: z.ZodObject<z.ZodRawShape>;
  schema: z.ZodObject<{ props: z.ZodObject<z.ZodRawShape>; slots: z.ZodObject<z.ZodRawShape> }>;
  events: readonly string[];
  meta: SkeletonMeta;
  Component: ComponentType<{ props: unknown; slots: Record<string, ReactNode> }>;
};

type ComponentProps<P extends z.ZodObject<z.ZodRawShape>, S extends z.ZodObject<z.ZodRawShape>> = z.infer<P> & {
  slots?: Partial<Record<Extract<keyof z.infer<S>, string>, ReactNode[]>>;
};
export type SkeletonDefinition<P extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>, S extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>> = {
  id: string;
  propsSchema: P;
  slotsSchema: S;
  schema: ReturnType<typeof createSkeletonSchema<P, S>>;
  events: readonly string[];
  meta: SkeletonMeta;
};

export function createSkeletonSchema<P extends z.ZodObject<z.ZodRawShape>, S extends z.ZodObject<z.ZodRawShape>>(props: P, slots: S) {
  return z.object({ props: props.strict(), slots: slots.strict() }).strict();
}

export function defineSkeletonDefinition<P extends z.ZodObject<z.ZodRawShape>, S extends z.ZodObject<z.ZodRawShape>>(entry: {
  id: string;
  props: P;
  slots: S;
  events: readonly string[];
  meta: SkeletonMeta;
}): SkeletonDefinition<P, S> {
  const propsSchema = entry.props.strict() as P;
  const slotsSchema = entry.slots.strict() as S;
  const schema = createSkeletonSchema(propsSchema, slotsSchema);
  return { id: entry.id, propsSchema, slotsSchema, schema, events: entry.events, meta: entry.meta };
}

export function defineSkeleton<P extends z.ZodObject<z.ZodRawShape>, S extends z.ZodObject<z.ZodRawShape>>(
  definition: SkeletonDefinition<P, S>,
  Skeleton: ComponentType<never>,
) {
  function Component({ props, slots }: { props: unknown; slots: Record<string, ReactNode> }) {
    const propsSchema = definition.propsSchema;
    const parsed = propsSchema.safeParse(props);
    if (!parsed.success) throw new Error("Skeleton props failed runtime validation");
    const slotArrays = Object.fromEntries(Object.entries(slots).map(([name, children]) => [name, Array.isArray(children) ? children : [children]]));
    return createElement(Skeleton as ComponentType<ComponentProps<P, S>>, { ...(parsed.data as ComponentProps<P, S>), slots: slotArrays as ComponentProps<P, S>["slots"] });
  }
  return {
    ...definition,
    Component,
  } satisfies SkeletonEntry;
}
