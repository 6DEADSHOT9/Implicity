import { z } from "zod";
export const propsSchema = z.object({ title: z.string().min(1), steps: z.array(z.object({ label: z.string().min(1), status: z.enum(["pending", "running", "complete", "error"]) }).strict()).min(1), open: z.boolean() }).strict();
export const slotsSchema = z.object({ steps: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)).max(0) }).strict();
