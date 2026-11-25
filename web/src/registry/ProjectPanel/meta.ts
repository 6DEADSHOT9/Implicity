export const meta = {
  role: "panel",
  slots: ["decisions", "constraints", "files"],
  defaultStates: ["decisions", "constraints", "files"],
  commands: [],
  limits: { minWidth: 288, minHeight: 180, minContrast: 4.5 },
  galleryStates: [
    { id: "decisions", props: { title: "Project", tabs: ["decisions", "constraints", "files"], activeTab: "decisions" }, slots: { decisions: ["decision_one"], constraints: [], files: [] } },
    { id: "constraints", props: { title: "Project", tabs: ["decisions", "constraints", "files"], activeTab: "constraints" }, slots: { decisions: [], constraints: ["constraint_one"], files: [] } },
    { id: "files", props: { title: "Project", tabs: ["decisions", "constraints", "files"], activeTab: "files" }, slots: { decisions: [], constraints: [], files: ["file_one"] } },
  ],
} as const;
