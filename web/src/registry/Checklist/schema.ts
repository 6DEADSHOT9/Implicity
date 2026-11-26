import { z } from "zod";
export const propsSchema = z.object({ title: z.string(), items: z.array(z.object({ label: z.string(), checked: z.boolean() })), state: z.enum(["default", "empty", "long_content", "error"]).default("default") });
export const slotsSchema = z.object({});
