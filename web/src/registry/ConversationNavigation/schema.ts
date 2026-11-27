import { z } from "zod";
const named = z.object({ id: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/), label: z.string() }).strict();
const namedList = z.array(named).superRefine((items, context) => {
  if (new Set(items.map(({ id }) => id)).size !== items.length) context.addIssue({ code: "custom", message: "Ids must be unique within each list" });
});
export const propsSchema = z.object({ items: namedList, recent: namedList, projects: namedList, quota: z.string() }).strict();
export const slotsSchema = z.object({}).strict();
