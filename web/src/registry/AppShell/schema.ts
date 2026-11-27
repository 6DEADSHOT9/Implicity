import { z } from "zod";
export const propsSchema = z.object({ panelOpen: z.boolean().default(false) }).strict();
export const slotsSchema = z.object({ main: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)).default([]), navigation: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)).default([]), panel: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)).default([]) }).strict();
