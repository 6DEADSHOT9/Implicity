import { z } from "zod";
export const propsSchema = z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())), chartValues: z.array(z.number()).optional(), form: z.enum(["table", "chart"]).default("table"), state: z.enum(["default", "empty", "loading", "long_content", "error"]).default("default") }).superRefine(({ rows, chartValues }, ctx) => {
  if (chartValues && rows.length !== chartValues.length) ctx.addIssue({ code: "custom", message: "Chart values must match the table rows", path: ["chartValues"] });
});
export const slotsSchema = z.object({});
