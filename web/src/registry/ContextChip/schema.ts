import { z } from "zod";
export const propsSchema = z.object({ detail: z.string().min(1), kind: z.enum(["remembered", "noticed", "set"]) }).strict();
export const slotsSchema = z.object({}).strict();
