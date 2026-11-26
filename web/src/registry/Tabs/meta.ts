import { skeletonMetaSchema } from "../define-skeleton.ts";
export const meta = skeletonMetaSchema.parse({
 role: "content", slots: [], defaultStates: ["default", "empty", "error"], commands: [],
 limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
 galleryStates: [{ id: "default", props: { tabs: [{ id: "overview", label: "Overview" }, { id: "details", label: "Details" }], selected: "overview" }, slots: { overview: [], details: [] } }, { id: "empty", props: { tabs: [{ id: "overview", label: "Overview" }], selected: "overview", state: "empty" } }, { id: "error", props: { tabs: [{ id: "overview", label: "Overview" }], selected: "overview", state: "error" } }]
});
