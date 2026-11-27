const widgets = [
  { widgetId: "home_resume", componentId: "ResumeWidget", label: "Resume", enabled: true },
  { widgetId: "home_projects", componentId: "ProjectsWidget", label: "Projects", enabled: true },
  { widgetId: "home_scheduled", componentId: "ScheduledWidget", label: "Scheduled", enabled: true },
  { widgetId: "home_quick_prompts", componentId: "QuickPromptsWidget", label: "Quick prompts", enabled: true },
  { widgetId: "home_now_playing", componentId: "NowPlayingWidget", label: "Now playing", enabled: true },
];

const availableWidgets = [{ widgetId: "supplier_watch", componentId: "DataTable", label: "Data table" }];

export const meta = {
  role: "home",
  slots: [],
  defaultStates: ["closed", "open"],
  commands: [],
  limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "closed", props: { open: false, title: "Add widgets", widgets, availableWidgets } },
    { id: "open", props: { open: true, title: "Add widgets", widgets, availableWidgets } },
    { id: "long-content", props: { open: true, title: "T".repeat(150), widgets, availableWidgets } },
  ],
} as const;
