import { z } from "zod";
export const propsSchema = z.object({ items: z.array(z.string()), recent: z.array(z.string()), projects: z.array(z.string()), quota: z.string() }).strict();
export const slotsSchema = z.object({}).strict();
