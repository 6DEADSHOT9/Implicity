export const meta = {
  role: "home",
  slots: ["content"],
  defaultStates: ["scheduled"],
  commands: [],
  widget: { source: "scheduled_source", refresh: "interval", intervalMinutes: 30 },
  limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "scheduled", props: {}, slots: { content: ["scheduled_source"] } },
    { id: "empty", props: {}, slots: { content: [] } },
    { id: "long-content", props: {}, slots: { content: ["long_content_example"] } },
  ],
} as const;
