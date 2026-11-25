import { skeletonMetaSchema } from "../define-skeleton.ts";
export const meta = skeletonMetaSchema.parse({
 role: "content", slots: [], defaultStates: ["default"], commands: [],
 limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
 galleryStates: [{ id: "default", props: { title: "Project update", description: "A short summary", content: "Three tasks are complete." } }, { id: "empty", props: { title: "Project update", state: "empty" } }, { id: "loading", props: { title: "Project update", state: "loading" } }, { id: "error", props: { title: "Project update", state: "error" } }]
});
