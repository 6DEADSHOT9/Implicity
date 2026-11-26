import { z } from "zod";
export const propsSchema = z.object({ label: z.string().min(1), url: z.string().url().refine((value) => /^https?:\/\//i.test(value)), source_type: z.enum(["web", "memory"]) }).strict();
export const slotsSchema = z.object({}).strict();
