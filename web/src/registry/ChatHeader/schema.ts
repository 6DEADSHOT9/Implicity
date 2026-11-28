import { z } from "zod";
export const propsSchema = z.object({ title: z.string(), kind: z.string().optional(), settingsOpen: z.boolean().default(false) }).strict();
export const slotsSchema = z.object({}).strict();
