import { skeletonMetaSchema } from "../define-skeleton.ts";
export const meta = skeletonMetaSchema.parse({
 role: "content", slots: [], defaultStates: ["default", "empty", "loading", "long_content", "error"], commands: [],
 limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
 galleryStates: [{ id: "default", props: { title: "Recipe", content: "Mix the ingredients and bake." } }, { id: "empty", props: { title: "Untitled", content: "", state: "empty" } }, { id: "loading", props: { title: "Recipe", content: "", state: "loading" } }, { id: "long_content", props: { title: "Draft", content: Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1}`).join("\n\n"), state: "long_content" } }, { id: "error", props: { title: "Draft", content: "", state: "error" } }]
});
