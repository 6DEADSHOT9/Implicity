import { z } from "zod";

export const propsSchema = z.object({ }).strict();
export const slotsSchema = z.object({ content: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)).default([]) }).strict();
