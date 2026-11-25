import { z } from "zod";
export const propsSchema = z.object({ title: z.string(), labels: z.array(z.string()), values: z.array(z.number()), chartType: z.enum(["bar", "line"]).default("bar"), state: z.enum(["default", "empty", "loading", "long_content", "error"]).default("default") });
export const slotsSchema = z.object({});
