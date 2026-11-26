export const meta = {
  role: "home",
  slots: ["content"],
  defaultStates: ["quick-prompts"],
  commands: [],
  widget: { source: "quick_prompts_source", refresh: "on_open" },
  limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "quick-prompts", props: {}, slots: { content: ["summarize_this_weeks_project_decisions"] } },
    { id: "empty", props: {}, slots: { content: [] } },
    { id: "long-content", props: {}, slots: { content: ["summarize_project_change_unresolved_decisions_next_status_update", "draft_next_status_update"] } },
  ],
} as const;
