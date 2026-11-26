export const meta = {
  role: "home",
  slots: ["content"],
  defaultStates: ["now-playing"],
  commands: [],
  widget: { source: "now_playing_source", refresh: "live" },
  limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "now-playing", props: { progress: 35 }, slots: { content: ["now_playing_source"] } },
    { id: "empty", props: { progress: 0 }, slots: { content: [] } },
    { id: "long-content", props: { progress: 35 }, slots: { content: ["long_content_example"] } },
  ],
} as const;
