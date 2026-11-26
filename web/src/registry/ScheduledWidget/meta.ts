export const meta = {
  role: "home",
  slots: ["content"],
  defaultStates: ["scheduled"],
  commands: [],
  widget: { source: "scheduled_source", refresh: "interval", intervalMinutes: 60 },
  limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "scheduled", props: {}, slots: { content: ["review_project_milestones_today_at_330_pm"] } },
    { id: "empty", props: {}, slots: { content: [] } },
    { id: "long-content", props: {}, slots: { content: ["review_project_launch_checklist_actions_and_owners_for_thursdays", "review_due_dates_and_owner_notes"] } },
  ],
} as const;
