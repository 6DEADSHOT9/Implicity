import { z } from "zod";
export const propsSchema = z.object({ title: z.string(), description: z.string().optional(), content: z.string().optional(), state: z.enum(["default", "empty", "loading", "error"]).default("default") });
export const slotsSchema = z.object({});
