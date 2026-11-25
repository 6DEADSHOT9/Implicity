export const meta = {
  role: "shell",
  slots: ["main"],
  defaultStates: ["plain"],
  commands: [],
  limits: { minWidth: 1, minHeight: 1, minContrast: 4.5 },
  galleryStates: [{ id: "plain", props: {}, slots: { main: ["content"] } }],
} as const;
