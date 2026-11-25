export const meta = {
  role: "content",
  slots: ["main"],
  defaultStates: ["plain"],
  commands: [],
  limits: { minWidth: 1, minHeight: 1, minContrast: 4.5 },
  galleryStates: [
    { id: "plain", props: { count: 1 }, slots: { main: ["one"] } },
    { id: "busy", props: { count: 4 }, slots: { main: ["two", "three"] } },
    { id: "error", props: { count: 0, fail: true }, slots: { main: [] } },
  ],
} as const;
