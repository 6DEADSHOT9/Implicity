export const meta = {
  role: "shell", slots: [], defaultStates: ["populated", "empty"], commands: ["go_home", "new_chat", "search", "open_chat", "open_project", "open_recent"],
  limits: { minWidth: 256, minHeight: 256, minContrast: 4.5 },
  galleryStates: [
    { id: "populated", props: { items: [{ id: "notes", label: "https://example.invalid/projects/notes-with-a-deliberately-long-unbroken-title-that-must-wrap-across-a-narrow-panel" }, { id: "planning", label: "Planning session" }], recent: [{ id: "recent-work", label: "Recent work" }], projects: [{ id: "research", label: "Research" }, { id: "writing", label: "Writing" }], quota: "72% remaining" } },
    { id: "empty", props: { items: [], recent: [], projects: [], quota: "Available" } },
  ],
} as const;
