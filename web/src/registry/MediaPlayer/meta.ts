import { skeletonMetaSchema } from "../define-skeleton.ts";
export const meta = skeletonMetaSchema.parse({
 role: "content", slots: [], defaultStates: ["default"], commands: [],
 limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
 galleryStates: [{ id: "default", props: { title: "Sample audio", mediaType: "audio" } }, { id: "empty", props: { title: "Sample audio", mediaType: "audio", state: "empty" } }, { id: "loading", props: { title: "Sample audio", mediaType: "audio", state: "loading" } }, { id: "error", props: { title: "Sample audio", mediaType: "video", state: "error" } }]
});
