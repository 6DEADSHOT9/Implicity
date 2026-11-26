export const meta = {
  role: "panel",
  slots: ["decisions", "constraints", "files"],
  defaultStates: ["decisions", "constraints", "files"],
  commands: [],
  limits: { minWidth: 288, minHeight: 180, minContrast: 4.5 },
  galleryStates: [
    { id: "decisions", props: { title: "Project", tabs: [{ id: "decisions", label: "Decisions" }, { id: "constraints", label: "Constraints" }, { id: "files", label: "Files" }], activeTab: "decisions" }, slots: { decisions: ["decision_one"], constraints: ["constraint_one"], files: ["file_one"] } },
    { id: "constraints", props: { title: "Project", tabs: [{ id: "decisions", label: "Decisions" }, { id: "constraints", label: "Constraints" }, { id: "files", label: "Files" }], activeTab: "constraints" }, slots: { decisions: ["decision_one"], constraints: ["constraint_one"], files: ["file_one"] } },
    { id: "files", props: { title: "Project", tabs: [{ id: "decisions", label: "Decisions" }, { id: "constraints", label: "Constraints" }, { id: "files", label: "Files" }], activeTab: "files" }, slots: { decisions: ["decision_one"], constraints: ["constraint_one"], files: ["file_one"] } },
  ],
} as const;
