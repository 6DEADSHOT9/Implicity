export const meta = {
  role: "panel",
  slots: [],
  defaultStates: ["closed", "docked"],
  commands: [],
  limits: { minWidth: 240, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "docked", props: { docked: true, sources: [{ title: "Reference one", type: "web" }, { title: "Reference two", type: "document" }] } },
    { id: "closed", props: { docked: false, sources: [{ title: "Reference one", type: "web" }, { title: "Reference two", type: "document" }] } },
  ],
} as const;
