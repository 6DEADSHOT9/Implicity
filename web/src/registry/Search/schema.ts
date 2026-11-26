import { z } from "zod";
export const propsSchema = z.object({ open: z.boolean(), results: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/), label: z.string() }).strict()) }).strict();
export const slotsSchema = z.object({}).strict();
