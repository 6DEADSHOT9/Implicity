const slots = { preferences: ["preferences_content"], locks: ["locks_content"], notices: ["notices_content"], history: ["history_content"], quota: ["quota_content"] };
export const meta = {
  role: "shell",
  slots: ["preferences", "locks", "notices", "history", "quota"],
  defaultStates: ["preferences", "locks", "notices", "history", "quota"],
  commands: [],
  limits: { minWidth: 320, minHeight: 320, minContrast: 4.5 },
  galleryStates: [
    ...["preferences", "locks", "notices", "history", "quota"].map((tab) => ({ id: tab, props: { open: true, tab }, slots })),
  ],
} as const;
