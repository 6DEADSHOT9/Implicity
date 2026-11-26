const longText = "Averylongunbrokenmessagepath/".repeat(18);
export const meta = { role: "content", slots: [], defaultStates: ["message"], commands: [], limits: { minWidth: 320, minHeight: 48, minContrast: 4.5 }, galleryStates: [
  { id: "message", props: { content: "A clear answer with **useful detail**.\n\n- First point\n- Second point\n\n## Next steps\n\n1. Review the result\n2. Share it" } },
  { id: "long_content", props: { content: longText } },
  { id: "rich_content", props: { content: "[Open source](https://example.test/source)\n\n```text\nA sample code block\n```\n\n| Item | Status |\n| --- | --- |\n| Sample | Ready |" } },
] } as const;
