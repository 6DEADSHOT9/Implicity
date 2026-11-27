import { z } from "zod";

const widget = z.object({
  widgetId: z.string().min(1),
  componentId: z.string().regex(/^[A-Z][A-Za-z0-9_-]{0,63}$/),
  label: z.string().min(1),
  enabled: z.boolean(),
}).strict();

const widgets = z.array(widget).superRefine((items, context) => {
  const ids = new Set<string>();
  items.forEach(({ widgetId }, index) => {
    if (ids.has(widgetId)) context.addIssue({ code: "custom", path: [index, "widgetId"], message: "widget ids must be unique" });
    ids.add(widgetId);
  });
});

export const propsSchema = z.object({
  open: z.boolean(),
  title: z.string().min(1),
  widgets,
  availableWidgets: z.array(widget.omit({ enabled: true })),
}).strict();
export const slotsSchema = z.object({}).strict();
