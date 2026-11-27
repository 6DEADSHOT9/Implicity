import { z } from "zod";

export const propsSchema = z.object({ content: z.string().min(1) }).strict();
export const slotsSchema = z.object({}).strict();
