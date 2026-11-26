import { skeletonMetaSchema } from "../define-skeleton.ts";
export const meta = skeletonMetaSchema.parse({
 role: "content", slots: ["content"], defaultStates: ["default", "empty", "loading", "error"], commands: [],
 limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
 galleryStates: [{ id: "default", props: { title: "Project update", description: "A short summary", content: "Three tasks are complete." }, slots: { content: [] } }, { id: "empty", props: { title: "Project update", state: "empty" }, slots: { content: [] } }, { id: "loading", props: { title: "Project update", state: "loading" }, slots: { content: [] } }, { id: "error", props: { title: "Project update", state: "error" }, slots: { content: [] } }]
});
