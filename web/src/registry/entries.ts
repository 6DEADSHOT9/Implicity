import { events as textBlockEvents } from "./TextBlock/events.ts";
import { meta as textBlockMeta } from "./TextBlock/meta.ts";
import { schema as textBlockSchema } from "./TextBlock/schema.ts";

export const entries = {
  TextBlock: { schema: textBlockSchema, events: textBlockEvents, meta: textBlockMeta },
};
