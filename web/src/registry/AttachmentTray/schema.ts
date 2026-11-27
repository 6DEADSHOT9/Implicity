import { z } from "zod";
export const propsSchema = z.object({ attachments: z.array(z.object({ id: z.string().uuid(), name: z.string().min(1), type: z.enum(["image", "document", "audio", "video", "other"]) }).strict()) }).strict().refine(({ attachments }) => new Set(attachments.map(({ id }) => id)).size === attachments.length);
export const slotsSchema = z.object({}).strict();
