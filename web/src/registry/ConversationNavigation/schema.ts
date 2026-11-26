import { z } from "zod";
const named = z.object({ id: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/), label: z.string() }).strict();
export const propsSchema = z.object({ items: z.array(named), recent: z.array(named), projects: z.array(named), quota: z.string() }).strict();
export const slotsSchema = z.object({}).strict();
