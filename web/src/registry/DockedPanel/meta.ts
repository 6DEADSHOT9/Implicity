const manyTabs = Array.from({ length: 18 }, (_, index) => ({
  id: index === 0 ? "details" : `activity_${index + 1}`,
  label: index === 0 ? "Details" : `Workspace decision and approval history ${index + 1}`,
}));

export const meta = {
  role: "panel",
  slots: [],
  defaultStates: ["open_docked", "open_undocked", "closed"],
  commands: [],
  limits: { minWidth: 384, minHeight: 160, minContrast: 4.5 },
  galleryStates: [
    { id: "open_docked", props: { title: "Workspace", tabs: [{ id: "details", label: "Details" }, { id: "history", label: "History" }], activeTab: "details", open: true, docked: true }, slots: { details: ["panel_content"], history: [] } },
    { id: "open_undocked", props: { title: "Workspace", tabs: manyTabs, activeTab: "activity_18", open: true, docked: false }, slots: Object.fromEntries(manyTabs.map(({ id }) => [id, id === "activity_18" ? ["panel_content"] : []])) },
    { id: "closed", props: { title: "Workspace", tabs: [{ id: "details", label: "Details" }, { id: "history", label: "History" }], activeTab: "details", open: false, docked: true }, slots: { details: [], history: [] } },
  ],
} as const;
