import { z } from "zod";
const result = z.object({ id: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/), label: z.string() }).strict();
const results = z.array(result).superRefine((items, context) => {
  if (new Set(items.map(({ id }) => id)).size !== items.length) context.addIssue({ code: "custom", message: "Result ids must be unique" });
});
export const propsSchema = z.object({ open: z.boolean(), results }).strict();
export const slotsSchema = z.object({}).strict();
