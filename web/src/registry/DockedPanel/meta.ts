export const meta = {
  role: "panel",
  slots: ["main"],
  defaultStates: ["open_docked"],
  commands: [],
  limits: { minWidth: 288, minHeight: 160, minContrast: 4.5 },
  galleryStates: [
    { id: "open_docked", props: { title: "Workspace", tabs: ["Details", "History"], activeTab: "Details", open: true, docked: true }, slots: { main: ["panel_content"] } },
    { id: "open_undocked", props: { title: "Workspace", tabs: ["Details", "History"], activeTab: "History", open: true, docked: false }, slots: { main: ["panel_content"] } },
    { id: "closed", props: { title: "Workspace", tabs: ["Details", "History"], activeTab: "Details", open: false, docked: true }, slots: { main: [] } },
  ],
} as const;
