import { z } from "zod";

export const propsSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  actionLabel: z.string().min(1),
}).strict();
export const slotsSchema = z.object({}).strict();
