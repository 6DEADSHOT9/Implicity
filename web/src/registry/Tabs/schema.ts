import { z } from "zod";
const id = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const propsSchema = z.object({ tabs: z.array(z.object({ id, label: z.string() })).min(1), selected: id, state: z.enum(["default", "empty", "error"]).default("default") }).superRefine(({ tabs, selected }, ctx) => {
  if (new Set(tabs.map(({ id }) => id)).size !== tabs.length) ctx.addIssue({ code: "custom", path: ["tabs"], message: "Tab ids must be unique" });
  if (!tabs.some(({ id }) => id === selected)) ctx.addIssue({ code: "custom", path: ["selected"], message: "Selected tab must exist" });
});
export const slotsSchema = z.object({}).catchall(z.array(id)).superRefine((slots, ctx) => {
  for (const key of Object.keys(slots)) if (!id.safeParse(key).success) ctx.addIssue({ code: "custom", path: [key], message: "Tab slot names must be identifiers" });
});
