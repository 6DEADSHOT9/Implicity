import { skeletonMetaSchema } from "../define-skeleton.ts";
export const meta = skeletonMetaSchema.parse({
 role: "content", slots: [], defaultStates: ["default"], commands: [],
 limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
 galleryStates: [{ id: "default", props: { items: ["First item", "Second item"] } }, { id: "empty", props: { items: [], state: "empty" } }, { id: "long_content", props: { items: Array.from({ length: 10 }, (_, i) => `Item ${i + 1}`), ordered: true, state: "long_content" } }, { id: "error", props: { items: [], state: "error" } }]
});
