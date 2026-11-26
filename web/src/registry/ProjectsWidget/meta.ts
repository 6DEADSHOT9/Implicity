export const meta = {
  role: "home",
  slots: ["content"],
  defaultStates: ["projects"],
  commands: [],
  widget: { source: "projects_source", refresh: "on_open" },
  limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "projects", props: {}, slots: { content: ["website_refresh_four_tasks_remaining"] } },
    { id: "empty", props: {}, slots: { content: [] } },
    { id: "long-content", props: {}, slots: { content: ["website_refresh_accessibility_checklist_for_next_project_reviews", "website_refresh_project_notes"] } },
  ],
} as const;
