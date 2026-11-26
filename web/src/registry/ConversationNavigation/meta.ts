export const meta = {
  role: "shell", slots: [], defaultStates: ["populated", "empty"], commands: [],
  limits: { minWidth: 320, minHeight: 64, minContrast: 4.5 },
  galleryStates: [
    { id: "populated", props: { items: ["https://example.invalid/projects/notes-with-a-deliberately-long-unbroken-title-that-must-wrap-across-a-narrow-panel", "Planning session"], recent: ["Recent work"], projects: ["Research", "Writing"], quota: "72% remaining" } },
    { id: "empty", props: { items: [], recent: [], projects: [], quota: "Available" } },
  ],
} as const;
