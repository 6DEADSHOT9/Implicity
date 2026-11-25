export const meta = {
  role: "system",
  slots: [],
  defaultStates: ["inline", "toast"],
  commands: [],
  limits: { minWidth: 320, minHeight: 64, minContrast: 4.5 },
  galleryStates: [
    { id: "inline", props: { decision_id: "dec_123e4567-e89b-42d3-a456-426614174000", title: "Density changed", reason: "Long answers were often expanded.", presentation: "inline" } },
    { id: "toast", props: { decision_id: "dec_123e4567-e89b-42d3-a456-426614174000", title: "Density changed", reason: "Long answers were often expanded.", presentation: "toast" } },
  ],
} as const;
