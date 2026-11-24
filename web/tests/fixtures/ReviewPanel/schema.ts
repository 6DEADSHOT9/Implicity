import { z } from "zod";
import { defineSkeletonDefinition } from "../../../src/registry/define-skeleton.ts";
import { events } from "./events.ts";
import { meta } from "./meta.ts";

const elementId = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const propsSchema = z.object({ count: z.number().int().nonnegative(), fail: z.boolean().optional() }).strict();
export const slotsSchema = z.object({ main: z.array(elementId) }).strict();
export const definition = defineSkeletonDefinition({ id: "ReviewPanel", props: propsSchema, slots: slotsSchema, events, meta });
