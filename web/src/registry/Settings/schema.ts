import { z } from "zod";

const slot = z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)).default([]);
export const propsSchema = z.object({ open: z.boolean().default(true), tab: z.enum(["preferences", "locks", "notices", "history", "quota"]) }).strict();
export const slotsSchema = z.object({ preferences: slot, locks: slot, notices: slot, history: slot, quota: slot }).strict();
