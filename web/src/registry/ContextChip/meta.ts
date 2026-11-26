const longText = "Averylongunbrokencontextvalue/".repeat(14);
export const meta = { role: "content", slots: [], defaultStates: ["remembered", "noticed", "set"], commands: [], limits: { minWidth: 320, minHeight: 48, minContrast: 4.5 }, galleryStates: [
  { id: "remembered", props: { detail: "You prefer concise answers.", kind: "remembered" } },
  { id: "noticed", props: { detail: "You often ask for examples.", kind: "noticed" } },
  { id: "set", props: { detail: "Use concise answers.", kind: "set" } },
  { id: "long_content", props: { detail: longText, kind: "remembered" } },
] } as const;
