import { z } from "zod";
export const propsSchema = z.object({ title: z.string().min(1), detail: z.string().min(1), state: z.enum(["pending", "approved", "denied"]) }).strict();
export const slotsSchema = z.object({}).strict();
