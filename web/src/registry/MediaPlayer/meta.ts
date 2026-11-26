import { skeletonMetaSchema } from "../define-skeleton.ts";
export const meta = skeletonMetaSchema.parse({
 role: "content", slots: [], defaultStates: ["default", "empty", "loading", "error"], commands: [],
 limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
 galleryStates: [{ id: "default", props: { title: "Sample audio", mediaType: "audio", sourceKind: "attachment", source: "https://example.com/sample.mp3" } }, { id: "youtube_audio", props: { title: "YouTube audio", mediaType: "audio", sourceKind: "youtube", source: "https://www.youtube-nocookie.com/embed/example" } }, { id: "attached_video", props: { title: "Attached video", mediaType: "video", sourceKind: "attachment", source: "https://example.com/sample.mp4" } }, { id: "youtube_video", props: { title: "YouTube video", mediaType: "video", sourceKind: "youtube", source: "https://www.youtube-nocookie.com/embed/example" } }, { id: "empty", props: { title: "Sample audio", mediaType: "audio", state: "empty" } }, { id: "loading", props: { title: "Sample audio", mediaType: "audio", state: "loading" } }, { id: "error", props: { title: "Sample audio", mediaType: "video", state: "error" } }]
});
