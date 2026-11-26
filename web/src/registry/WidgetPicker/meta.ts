export const meta = {
  role: "home",
  slots: ["widgets"],
  defaultStates: ["closed", "open"],
  commands: [],
  limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
  galleryStates: [
    { id: "closed", props: { open: false, title: "Add widgets", enabled: true }, slots: { widgets: ["resume_widget", "projects_widget"] } },
    { id: "open", props: { open: true, title: "Add widgets", enabled: true }, slots: { widgets: ["resume_widget", "projects_widget"] } },
    { id: "long-content", props: { open: true, title: "https://example.invalid/a/very-long-widget-picker-title-that-wraps-without-breaking-ordinary-words-or-overflowing-the-screen", enabled: true }, slots: { widgets: ["widget_01", "widget_02", "widget_03", "widget_04", "widget_05", "widget_06", "widget_07", "widget_08", "widget_09", "widget_10", "widget_11", "widget_12", "widget_13", "widget_14", "widget_15", "widget_16", "widget_17", "widget_18", "widget_19", "widget_20", "widget_21", "widget_22", "widget_23", "widget_24", "widget_25", "widget_26", "widget_27", "widget_28", "widget_29", "widget_30", "widget_31", "widget_32", "widget_33", "widget_34", "widget_35", "widget_36", "widget_37", "widget_38", "widget_39", "widget_40", "widget_41", "widget_42", "widget_43", "widget_44", "widget_45", "widget_46", "widget_47", "widget_48", "widget_49", "widget_50", "widget_51", "widget_52", "widget_53", "widget_54", "widget_55", "widget_56", "widget_57", "widget_58", "widget_59", "widget_60"] } },
  ],
} as const;
