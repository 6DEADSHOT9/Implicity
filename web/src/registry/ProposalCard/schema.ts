import { z } from "zod";

export const propsSchema = z.object({
  proposal_id: z.string().regex(/^prop_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
  proposal_type: z.enum(["look", "widget", "workflow", "kind", "schedule", "dimension"]),
  title: z.string().min(1),
  description: z.string().min(1),
  preview: z.string().min(1),
}).strict();
export const slotsSchema = z.object({}).strict();
