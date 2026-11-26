import { z } from "zod";
export const propsSchema = z.object({ answer_form: z.enum(["prose", "list", "table"]), version_index: z.number().int().positive(), version_count: z.number().int().positive() }).strict().refine(({ version_index, version_count }) => version_index <= version_count);
export const slotsSchema = z.object({}).strict();
