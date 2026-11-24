import { z } from "zod";

const elementId = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const propsSchema = z.object({ count: z.number().int().nonnegative(), fail: z.boolean().optional() }).strict();
export const slotsSchema = z.object({ main: z.array(elementId) }).strict();
