const slots = { preferences: ["preferences_content"], locks: ["locks_content"], notices: ["notices_content"], history: ["history_content"], quota: ["quota_content"] };
export const meta = {
  role: "shell",
  slots: ["preferences", "locks", "notices", "history", "quota"],
  defaultStates: ["preferences", "notices"],
  commands: [],
  limits: { minWidth: 320, minHeight: 64, minContrast: 4.5 },
  galleryStates: [
    { id: "preferences", props: { tab: "preferences" }, slots },
    { id: "notices", props: { tab: "notices" }, slots },
  ],
} as const;
