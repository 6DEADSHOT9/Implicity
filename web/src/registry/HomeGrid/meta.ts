export const meta = {
  role: "home",
  slots: ["widgets"],
  defaultStates: ["grid"],
  commands: [],
  limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "grid", props: { title: "Your Home" }, slots: { widgets: ["resume_widget", "projects_widget"] } },
    { id: "empty", props: { title: "Your Home" }, slots: { widgets: [] } },
    { id: "long-content", props: { title: "https://example.invalid/a/very-long-home-title-that-wraps-without-breaking-ordinary-words-or-overflowing-the-screen" }, slots: { widgets: ["example_widget"] } },
  ],
} as const;
