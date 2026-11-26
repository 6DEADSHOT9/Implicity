export const meta = {
  role: "system",
  slots: [],
  defaultStates: ["prompt"],
  commands: [],
  limits: { minWidth: 320, minHeight: 88, minContrast: 4.5 },
  galleryStates: [{ id: "prompt", props: { title: "Continue your project", message: "Pick up where you left off.", actionLabel: "Open project" } }],
} as const;
