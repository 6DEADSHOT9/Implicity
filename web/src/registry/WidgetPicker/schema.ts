import { z } from "zod";

const widget = z.object({
  id: z.string().regex(/^[A-Z][A-Za-z0-9_-]{0,63}$/),
  label: z.string().min(1),
  enabled: z.boolean(),
}).strict();

export const propsSchema = z.object({
  open: z.boolean(),
  title: z.string().min(1),
  widgets: z.array(widget),
  availableWidgets: z.array(widget.omit({ enabled: true })),
}).strict();
export const slotsSchema = z.object({}).strict();
