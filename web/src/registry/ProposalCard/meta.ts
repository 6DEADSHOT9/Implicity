export const meta = {
  role: "system",
  slots: [],
  defaultStates: ["preview"],
  commands: [],
  limits: { minWidth: 320, minHeight: 160, minContrast: 4.5 },
  galleryStates: [{ id: "preview", props: { proposal_id: "prop_123e4567-e89b-42d3-a456-426614174000", proposal_type: "look", title: "Notebook look", description: "A softer reading layout.", preview: "Longer headings and roomier spacing." } }],
} as const;
