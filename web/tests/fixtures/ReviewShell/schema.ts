import { z } from "zod";

const elementId = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const propsSchema = z.object({ title: z.string().optional() }).strict();
export const slotsSchema = z.object({ main: z.array(elementId) }).strict();
