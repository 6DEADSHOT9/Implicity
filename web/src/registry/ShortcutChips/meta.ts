const commands = [{ id: "copy_answer", label: "Copy answer" }, { id: "regenerate_answer", label: "Try another answer" }] as const;
export const meta = { role: "content", slots: [], defaultStates: ["suggested"], commands: ["copy_answer", "regenerate_answer"], limits: { minWidth: 320, minHeight: 48, minContrast: 4.5 }, galleryStates: [{ id: "suggested", props: { commands } }] } as const;
