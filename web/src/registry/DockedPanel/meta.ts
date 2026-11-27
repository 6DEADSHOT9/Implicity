const longProse = "Release readiness and operational handover checklist for the production rollout, including service ownership, alert response and rollback notes";
const unbrokenLabel = "x".repeat(400);
const manyTabs = Array.from({ length: 18 }, (_, index) => ({
  id: index === 0 ? "details" : `activity_${index + 1}`,
  label: index === 0 ? "Details" : index === 1 ? longProse : index === 2 ? unbrokenLabel : `Workspace decision and approval history ${index + 1}`,
}));

export const meta = {
  role: "panel",
  slots: [],
  defaultStates: ["open_docked", "open_undocked", "closed"],
  commands: [],
  limits: { minWidth: 384, minHeight: 160, minContrast: 4.5 },
  galleryStates: [
    { id: "open_docked", props: { title: "Workspace", tabs: [{ id: "details", label: "Details" }, { id: "history", label: "History" }], activeTab: "details", open: true, docked: true }, slots: { details: ["panel_content"], history: [] } },
    { id: "open_undocked", props: { title: "Workspace", tabs: [{ id: "details", label: "Details" }, { id: "history", label: "History" }], activeTab: "details", open: true, docked: false }, slots: { details: ["panel_content"], history: [] } },
    { id: "closed", props: { title: "Workspace", tabs: [{ id: "details", label: "Details" }, { id: "history", label: "History" }], activeTab: "details", open: false, docked: true }, slots: { details: [], history: [] } },
    { id: "stress", props: { title: "Workspace", tabs: [{ id: "details", label: "A" }, ...manyTabs.slice(1)], activeTab: "activity_18", open: true, docked: false }, slots: Object.fromEntries(manyTabs.map(({ id }) => [id, id === "activity_18" ? ["panel_content"] : []])) },
  ],
} as const;
