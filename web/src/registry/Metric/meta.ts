import { skeletonMetaSchema } from "../define-skeleton.ts";
export const meta = skeletonMetaSchema.parse({
 role: "content", slots: [], defaultStates: ["default"], commands: [],
 limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
 galleryStates: [{ id: "default", props: { label: "Tasks completed", value: "18", context: "This week" } }, { id: "empty", props: { label: "Tasks completed", value: "", state: "empty" } }, { id: "loading", props: { label: "Tasks completed", value: "", state: "loading" } }, { id: "error", props: { label: "Tasks completed", value: "", state: "error" } }]
});
