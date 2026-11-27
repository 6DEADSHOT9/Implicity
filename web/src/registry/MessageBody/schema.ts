import { z } from "zod";

export const propsSchema = z.object({ content: z.string().min(1), longAnswerState: z.enum(["folded", "open"]).optional() }).strict();
const elementId = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const slotsSchema = z.object({ long_answer: z.array(elementId).optional() }).strict();
