import { z } from "zod";
export const propsSchema = z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())), chartValues: z.array(z.number()).optional(), form: z.enum(["table", "chart"]).default("table"), state: z.enum(["default", "empty", "loading", "long_content", "error"]).default("default") });
export const slotsSchema = z.object({});
