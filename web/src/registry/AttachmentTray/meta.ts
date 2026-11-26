const longName = "https://example.test/a/very/long/unbroken/reference-file-name-".repeat(5);
export const meta = { role: "content", slots: [], defaultStates: ["empty", "attached"], commands: [], limits: { minWidth: 320, minHeight: 48, minContrast: 4.5 }, galleryStates: [
  { id: "empty", props: { attachments: [] } },
  { id: "attached", props: { attachments: [{ id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301", name: "Reference image", type: "image" }, { id: "3f2504e0-4f89-41d3-9a0c-0305e82c3302", name: "Project notes", type: "document" }] } },
  { id: "long_content", props: { attachments: [{ id: "3f2504e0-4f89-41d3-9a0c-0305e82c3303", name: longName, type: "document" }] } },
] } as const;
