import { z } from "zod";

const childId = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const tabNames = ["Details", "History"] as const;
const tabsSchema = z.array(z.enum(tabNames)).length(tabNames.length)
  .refine((tabs) => new Set(tabs).size === tabs.length)
  .meta({ uniqueItems: true });
export const propsSchema = z.object({
  title: z.string(), tabs: tabsSchema, activeTab: z.enum(tabNames), open: z.boolean(), docked: z.boolean(),
}).strict();
export const slotsSchema = z.object({ main: z.array(childId) }).strict();
