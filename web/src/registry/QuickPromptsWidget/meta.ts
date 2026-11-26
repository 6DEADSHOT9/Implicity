export const meta = {
  role: "home",
  slots: ["content"],
  defaultStates: ["quick-prompts"],
  commands: [],
  widget: { source: "quick_prompts_source", refresh: "on_open" },
  limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "quick-prompts", props: {}, slots: { content: ["quick_prompts_source"] } },
    { id: "empty", props: {}, slots: { content: [] } },
    { id: "long-content", props: {}, slots: { content: ["long_content_example"] } },
  ],
} as const;
