import { z } from "zod";

const childId = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const propsSchema = z.object({
  title: z.string(),
  tabs: z.array(z.string()).min(1),
  activeTab: z.string(),
  open: z.boolean(),
  docked: z.boolean(),
}).strict();
export const slotsSchema = z.object({ main: z.array(childId) }).strict();
