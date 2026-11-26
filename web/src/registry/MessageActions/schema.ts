import { z } from "zod";
export const propsSchema = z.object({ answer_form: z.enum(["prose", "list", "table"]) }).strict();
export const slotsSchema = z.object({}).strict();
