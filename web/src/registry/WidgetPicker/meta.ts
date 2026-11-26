const widgets = [
  { id: "ResumeWidget", label: "Resume", enabled: true },
  { id: "ProjectsWidget", label: "Projects", enabled: true },
  { id: "ScheduledWidget", label: "Scheduled", enabled: true },
  { id: "QuickPromptsWidget", label: "Quick prompts", enabled: true },
  { id: "NowPlayingWidget", label: "Now playing", enabled: true },
];

export const meta = {
  role: "home",
  slots: [],
  defaultStates: ["closed", "open"],
  commands: [],
  limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "closed", props: { open: false, title: "Add widgets", widgets, availableWidgets: [{ id: "DataTable", label: "Data table" }] } },
    { id: "open", props: { open: true, title: "Add widgets", widgets, availableWidgets: [{ id: "DataTable", label: "Data table" }] } },
    { id: "long-content", props: { open: true, title: "T".repeat(150), widgets, availableWidgets: [{ id: "DataTable", label: "Data table" }] } },
  ],
} as const;
