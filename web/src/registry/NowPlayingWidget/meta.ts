export const meta = {
  role: "home",
  slots: ["content"],
  defaultStates: ["now-playing"],
  commands: [],
  widget: { source: "now_playing_source", refresh: "live" },
  limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "now-playing", props: { progress: 35 }, slots: { content: ["quiet_focus_mix_track_four"] } },
    { id: "empty", props: { progress: 0 }, slots: { content: [] } },
    { id: "long-content", props: { progress: 35 }, slots: { content: ["focus_playlist_track_4_project_milestone_review_instrumental_mix", "focus_playlist_track_four"] } },
  ],
} as const;
