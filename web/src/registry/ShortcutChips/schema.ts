import { z } from "zod";
const commandId = /^(?:(?!cmd_)[A-Za-z][A-Za-z0-9_-]{0,63}|cmd_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
export const propsSchema = z.object({ commands: z.array(z.object({ id: z.string().regex(commandId), label: z.string().min(1) }).strict()).min(1) }).strict().refine(({ commands }) => new Set(commands.map(({ id }) => id)).size === commands.length);
export const slotsSchema = z.object({}).strict();
