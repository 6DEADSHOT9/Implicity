const version = { version_index: 2, version_count: 3 } as const;
export const meta = { role: "content", slots: [], defaultStates: ["prose", "list", "table"], commands: ["copy_answer", "regenerate_answer", "remember_answer"], limits: { minWidth: 320, minHeight: 48, minContrast: 4.5 }, galleryStates: [
  { id: "prose", props: { answer_form: "prose", ...version } },
  { id: "list", props: { answer_form: "list", ...version } },
  { id: "table", props: { answer_form: "table", ...version } },
  { id: "long_content", props: { answer_form: "prose", version_index: 1, version_count: 999 } },
] } as const;
