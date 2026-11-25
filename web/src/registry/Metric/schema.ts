import { z } from "zod";
export const propsSchema = z.object({ label: z.string(), value: z.string(), context: z.string().optional(), state: z.enum(["default", "empty", "loading", "error"]).default("default") });
export const slotsSchema = z.object({});
