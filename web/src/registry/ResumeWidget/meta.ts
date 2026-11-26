export const meta = {
  role: "home",
  slots: ["content"],
  defaultStates: ["resume"],
  commands: [],
  widget: { source: "resume_source", refresh: "on_open" },
  limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "resume", props: {}, slots: { content: ["resume_source"] } },
    { id: "empty", props: {}, slots: { content: [] } },
    { id: "long-content", props: {}, slots: { content: ["long_content_example"] } },
  ],
} as const;
