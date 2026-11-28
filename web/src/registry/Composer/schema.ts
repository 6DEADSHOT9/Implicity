import { z } from "zod";
const builtInCommands = ["search", "go_home", "new_chat", "open_chat", "open_project", "open_recent", "toggle_panel", "open_settings"] as const;
const commandId = z.enum(builtInCommands).or(z.string().regex(/^cmd_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
const named = z.object({ id: commandId, label: z.string() }).strict();
const shortcuts = z.array(named).superRefine((items, context) => {
  if (new Set(items.map(({ id }) => id)).size !== items.length) context.addIssue({ code: "custom", message: "Shortcut ids must be unique" });
});
export const propsSchema = z.object({ attachments: z.array(z.string()), shortcuts, disabled: z.boolean().optional(), attachmentsEnabled: z.boolean().optional() }).strict();
export const slotsSchema = z.object({}).strict();
