import { z } from "zod";
export const propsSchema = z.object({ title: z.string(), content: z.string(), state: z.enum(["default", "empty", "loading", "long_content", "error"]).default("default") });
export const slotsSchema = z.object({});
