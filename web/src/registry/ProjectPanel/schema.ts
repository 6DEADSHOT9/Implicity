import { z } from "zod";

const childId = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const tabNames = ["decisions", "constraints", "files"] as const;
const tabsSchema = z.array(z.enum(tabNames)).length(tabNames.length)
  .refine((tabs) => new Set(tabs).size === tabs.length)
  .meta({ uniqueItems: true });
export const propsSchema = z.object({ title: z.string(), tabs: tabsSchema, activeTab: z.enum(tabNames) }).strict();
export const slotsSchema = z.object({ decisions: z.array(childId), constraints: z.array(childId), files: z.array(childId) }).strict();
