import { skeletonMetaSchema } from "../define-skeleton.ts";
export const meta = skeletonMetaSchema.parse({
 role: "content", slots: [], defaultStates: ["default"], commands: [],
 limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
 galleryStates: [{ id: "default", props: { title: "Next steps", items: [{ label: "Review draft", checked: true }, { label: "Share with team", checked: false }] } }, { id: "empty", props: { title: "Next steps", items: [], state: "empty" } }, { id: "long_content", props: { title: "Next steps", items: Array.from({ length: 10 }, (_, i) => ({ label: `Step ${i + 1}`, checked: i < 3 })), state: "long_content" } }, { id: "error", props: { title: "Next steps", items: [], state: "error" } }]
});
