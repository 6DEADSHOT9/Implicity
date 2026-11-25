import { z } from "zod";
export const propsSchema = z.object({ tabs: z.array(z.object({ id: z.string(), label: z.string(), content: z.string() })).min(1), selected: z.string(), state: z.enum(["default", "empty", "error"]).default("default") });
export const slotsSchema = z.object({});
