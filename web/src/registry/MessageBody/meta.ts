const longText = "A clear answer with useful detail.\n\n" + "More context follows in this paragraph. ".repeat(80);
export const meta = { role: "content", slots: ["long_answer"], defaultStates: ["message", "folded", "open"], commands: [], limits: { minWidth: 320, minHeight: 48, minContrast: 4.5 }, galleryStates: [
  { id: "message", props: { content: "A clear answer with **useful detail**.\n\n- First point\n- Second point\n\n## Next steps\n\n1. Review the result\n2. Share it" }, slots: {} },
  { id: "folded", props: { content: longText, longAnswerState: "folded" }, slots: { long_answer: ["lead"] } },
  { id: "open", props: { content: longText, longAnswerState: "open" }, slots: { long_answer: ["full-answer"] } },
  { id: "long_content", props: { content: longText }, slots: { long_answer: ["lead"] } },
  { id: "rich_content", props: { content: "[Open source](https://example.test/source)\n\n```text\nA sample code block\n```\n\n| Item | Status |\n| --- | --- |\n| Sample | Ready |" }, slots: {} },
] } as const;
