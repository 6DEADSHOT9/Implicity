import { z } from "zod";
export const propsSchema = z.object({ open: z.boolean(), results: z.array(z.string()) }).strict();
export const slotsSchema = z.object({}).strict();
