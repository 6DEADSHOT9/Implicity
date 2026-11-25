import { z } from "zod";

const childId = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const tabNames = ["decisions", "constraints", "files"] as const;
export const propsSchema = z.object({ title: z.string(), tabs: z.array(z.object({ id: z.enum(tabNames), label: z.string() }).strict()).min(1), activeTab: z.enum(tabNames) }).strict().superRefine(({ tabs, activeTab }, context) => {
  const ids = tabs.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", path: ["tabs"], message: "Tab ids must be unique" });
  if (!ids.includes(activeTab)) context.addIssue({ code: "custom", path: ["activeTab"], message: "The active tab must be present" });
});
export const slotsSchema = z.object({ decisions: z.array(childId).optional(), constraints: z.array(childId).optional(), files: z.array(childId).optional() }).strict();
