import { z } from "zod";
export const propsSchema = z.object({ title: z.string(), description: z.string().optional(), content: z.string().optional(), state: z.enum(["default", "empty", "loading", "error"]).default("default") });
export const slotsSchema = z.object({ content: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)).default([]) });
