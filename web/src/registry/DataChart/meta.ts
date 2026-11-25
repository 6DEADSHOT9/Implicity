import { skeletonMetaSchema } from "../define-skeleton.ts";
export const meta = skeletonMetaSchema.parse({
 role: "content", slots: [], defaultStates: ["default"], commands: [],
 limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
 galleryStates: [{ id: "default", props: { title: "Monthly activity", labels: ["Jan", "Feb", "Mar"], values: [12, 19, 14] } }, { id: "empty", props: { title: "Monthly activity", labels: [], values: [], state: "empty" } }, { id: "loading", props: { title: "Monthly activity", labels: [], values: [], state: "loading" } }, { id: "long_content", props: { title: "Monthly activity", labels: Array.from({ length: 12 }, (_, i) => `Month ${i + 1}`), values: Array.from({ length: 12 }, (_, i) => i * 3), chartType: "line", state: "long_content" } }, { id: "error", props: { title: "Monthly activity", labels: [], values: [], state: "error" } }]
});
