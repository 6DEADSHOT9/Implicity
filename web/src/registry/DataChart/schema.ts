import { z } from "zod";
export const propsSchema = z.object({ title: z.string(), labels: z.array(z.string()), values: z.array(z.number()), state: z.enum(["default", "empty", "loading", "long_content", "error"]).default("default") });
export const slotsSchema = z.object({});
