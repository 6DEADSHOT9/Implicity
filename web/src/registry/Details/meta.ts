const longText = "Averylongunbrokenexplanation/".repeat(12);
export const meta = { role: "content", slots: ["details"], defaultStates: ["folded", "open"], commands: [], limits: { minWidth: 320, minHeight: 48, minContrast: 4.5 }, galleryStates: [
  { id: "folded", props: { title: "Why this works", content: "The result follows from the evidence.", open: false }, slots: {} },
  { id: "open", props: { title: "Why this works", content: "The result follows from the evidence.", open: true }, slots: {} },
  { id: "long_content", props: { title: "Why this works", content: longText, open: true }, slots: {} },
] } as const;
