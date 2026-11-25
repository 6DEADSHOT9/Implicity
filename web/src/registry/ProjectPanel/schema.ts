import { z } from "zod";

const childId = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const propsSchema = z.object({ title: z.string(), tabs: z.array(z.enum(["decisions", "constraints", "files"])).min(1), activeTab: z.enum(["decisions", "constraints", "files"]) }).strict();
export const slotsSchema = z.object({ decisions: z.array(childId), constraints: z.array(childId), files: z.array(childId) }).strict();
