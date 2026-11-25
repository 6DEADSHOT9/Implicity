import { z } from "zod";
export const propsSchema = z.object({ title: z.string(), mediaType: z.enum(["audio", "video"]), source: z.url({ protocol: /^https?$/ }).optional(), state: z.enum(["default", "empty", "loading", "error"]).default("default") });
export const slotsSchema = z.object({});
