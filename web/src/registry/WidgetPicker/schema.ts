import { z } from "zod";
export const propsSchema = z.object({ open: z.boolean(), title: z.string().min(1) }).strict();
export const slotsSchema = z.object({ widgets: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)).default([]) }).strict();
