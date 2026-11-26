import { z } from "zod";
export const propsSchema = z.object({ label: z.string().min(1), source_type: z.enum(["web", "memory"]), source: z.string().min(1) }).strict().superRefine(({ source_type, source }, context) => {
  const valid = source_type === "web" ? /^https:\/\//.test(source) && z.string().url().safeParse(source).success : z.string().uuid().safeParse(source).success;
  if (!valid) context.addIssue({ code: "custom", path: ["source"], message: "Source must match its source type" });
});
export const slotsSchema = z.object({}).strict();
