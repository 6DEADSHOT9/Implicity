import { z } from "zod";

export const propsSchema = z.object({
  sources: z.array(z.object({ title: z.string(), type: z.enum(["web", "document", "other"]) }).strict()),
}).strict();
export const slotsSchema = z.object({}).strict();
