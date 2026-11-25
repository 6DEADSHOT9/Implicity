export const meta = {
  role: "panel",
  slots: [],
  defaultStates: ["populated", "empty"],
  commands: [],
  limits: { minWidth: 240, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "populated", props: { sources: [{ title: "Reference one", type: "web" }, { title: "Reference two", type: "document" }] } },
    { id: "empty", props: { sources: [] } },
  ],
} as const;
