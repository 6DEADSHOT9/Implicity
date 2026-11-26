const steps = [{ label: "Search the source", status: "complete" }, { label: "Compare the results", status: "running" }, { label: "Prepare the summary", status: "pending" }] as const;
const longText = "Averylongunbrokenstepidentifier/".repeat(14);
const slot = { steps: [] } as const;
export const meta = { role: "content", slots: ["steps"], defaultStates: ["folded", "open"], commands: [], limits: { minWidth: 320, minHeight: 48, minContrast: 4.5 }, galleryStates: [
  { id: "folded", props: { title: "Run activity", steps, open: false }, slots: slot },
  { id: "open", props: { title: "Run activity", steps, open: true }, slots: slot },
  { id: "long_content", props: { title: longText, steps: [{ label: longText, status: "running" }], open: true }, slots: slot },
  { id: "error", props: { title: "Run activity", steps: [{ label: "The operation failed", status: "error" }], open: true }, slots: slot },
] } as const;
