import { z } from "zod";
export const propsSchema = z.object({ code: z.string(), language: z.string().default("text"), variant: z.enum(["code", "diff", "stack_trace", "terminal"]).default("code"), state: z.enum(["default", "empty", "long_content", "error"]).default("default") });
export const slotsSchema = z.object({});
