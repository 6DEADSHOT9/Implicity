import { z } from "zod";

export const propsSchema = z.object({
  decision_id: z.string().regex(/^dec_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
  title: z.string().min(1),
  reason: z.string().min(1),
  presentation: z.enum(["inline", "toast"]),
}).strict();
export const slotsSchema = z.object({}).strict();
