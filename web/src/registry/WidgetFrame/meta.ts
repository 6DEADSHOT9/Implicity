export const meta = {
  role: "home",
  slots: ["content"],
  defaultStates: ["frame"],
  commands: [],
  limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "frame", props: { title: "Project overview", lastUpdate: "Updated today", source: "Workspace" }, slots: { content: ["recent_activity"] } },
    { id: "empty", props: { title: "Project overview", lastUpdate: "Updated today", source: "Workspace" }, slots: { content: [] } },
    { id: "long-content", props: { title: "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT", lastUpdate: "Updated today", source: "Workspace" }, slots: { content: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"] } },
  ],
} as const;
