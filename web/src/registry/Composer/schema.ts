import { z } from "zod";
export const propsSchema = z.object({ attachments: z.array(z.string()), shortcuts: z.array(z.string()) }).strict();
export const slotsSchema = z.object({}).strict();
