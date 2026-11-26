import { z } from "zod";
export const propsSchema = z.object({ commands: z.array(z.object({ id: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/), label: z.string().min(1) }).strict()).min(1) }).strict().refine(({ commands }) => new Set(commands.map(({ id }) => id)).size === commands.length);
export const slotsSchema = z.object({}).strict();
