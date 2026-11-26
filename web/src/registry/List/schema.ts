import { z } from "zod";
export const propsSchema = z.object({ items: z.array(z.string()), ordered: z.boolean().default(false), state: z.enum(["default", "empty", "long_content", "error"]).default("default") });
export const slotsSchema = z.object({});
