import { z } from "zod";

const childId = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const identifier = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const propsSchema = z.object({
  title: z.string(),
  tabs: z.array(z.object({ id: identifier, label: z.string() }).strict()).min(1),
  activeTab: identifier,
  open: z.boolean(),
  docked: z.boolean(),
}).strict().superRefine(({ tabs, activeTab }, context) => {
  const ids = tabs.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", path: ["tabs"], message: "Tab ids must be unique" });
  if (!ids.includes(activeTab)) context.addIssue({ code: "custom", path: ["activeTab"], message: "The active tab must be present" });
});
export const slotsSchema = z.record(identifier, z.array(childId));
