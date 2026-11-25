import { skeletonMetaSchema } from "../define-skeleton.ts";
export const meta = skeletonMetaSchema.parse({
 role: "content", slots: [], defaultStates: ["default"], commands: [],
 limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
 galleryStates: [{ id: "default", props: { code: "const answer = 42;", language: "javascript" } }, { id: "empty", props: { code: "", language: "text", state: "empty" } }, { id: "long_content", props: { code: Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n"), language: "text", state: "long_content" } }, { id: "error", props: { code: "", state: "error" } }]
});
