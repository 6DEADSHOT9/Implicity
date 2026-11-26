export const meta = {
  role: "home",
  slots: ["content"],
  defaultStates: ["resume"],
  commands: [],
  widget: { source: "resume_source", refresh: "on_open" },
  limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "resume", props: {}, slots: { content: ["launch_planning_conversation"] } },
    { id: "empty", props: {}, slots: { content: [] } },
    { id: "long-content", props: {}, slots: { content: ["planning_launch_decisions_and_open_questions_from_product_review", "launch_planning_project_notes"] } },
  ],
} as const;
