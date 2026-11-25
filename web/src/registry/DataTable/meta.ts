import { skeletonMetaSchema } from "../define-skeleton.ts";
export const meta = skeletonMetaSchema.parse({
 role: "content", slots: [], defaultStates: ["default"], commands: [],
 limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
 galleryStates: [{ id: "default", props: { columns: ["Month", "Sales"], rows: [["January", "$120"], ["February", "$180"]], chartValues: [120, 180], form: "table", state: "default" } }, { id: "empty", props: { columns: ["Month", "Sales"], rows: [], state: "empty" } }, { id: "loading", props: { columns: ["Month", "Sales"], rows: [], state: "loading" } }, { id: "long_content", props: { columns: ["Month", "Sales"], rows: Array.from({ length: 8 }, (_, index) => [`Month ${index + 1}`, String(index * 10)]), chartValues: Array.from({ length: 8 }, (_, index) => index * 10), state: "long_content" } }, { id: "error", props: { columns: ["Month", "Sales"], rows: [], state: "error" } }]
});
