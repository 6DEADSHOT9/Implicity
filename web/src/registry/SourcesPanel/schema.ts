import { z } from "zod";

export const propsSchema = z.object({
  docked: z.boolean(),
  sources: z.array(z.object({ title: z.string(), type: z.enum(["web", "document", "other"]) }).strict()).optional(),
}).strict();
export const slotsSchema = z.object({}).strict();
