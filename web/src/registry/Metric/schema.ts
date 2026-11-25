import { z } from "zod";
export const propsSchema = z.object({ label: z.string(), value: z.string(), progress: z.object({ value: z.number().nonnegative(), max: z.number().positive() }).optional(), context: z.string().optional(), state: z.enum(["default", "empty", "loading", "error"]).default("default") });
export const slotsSchema = z.object({});
