import { z } from "zod";
export const propsSchema = z.object({ title: z.string(), labels: z.array(z.string()), values: z.array(z.number()), chartType: z.enum(["bar", "line"]).default("bar"), state: z.enum(["default", "empty", "loading", "long_content", "error"]).default("default") }).superRefine(({ labels, values }, ctx) => {
  if (labels.length !== values.length) ctx.addIssue({ code: "custom", message: "Labels and values must have the same length", path: ["values"] });
});
export const slotsSchema = z.object({});
