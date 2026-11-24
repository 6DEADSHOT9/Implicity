import { z } from "zod";

export const propsSchema = z.object({ text: z.string() }).strict();
export const slotsSchema = z.object({}).strict();
export const schema = z.object({ props: propsSchema, slots: slotsSchema }).strict();
