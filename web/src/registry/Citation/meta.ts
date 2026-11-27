const longLabel = "https://example.test/a/very/long/unbroken/citation-label/".repeat(4);
export const meta = { role: "content", slots: [], defaultStates: ["web", "memory"], commands: [], limits: { minWidth: 320, minHeight: 44, minContrast: 4.5 }, galleryStates: [
  { id: "web", props: { label: "Research overview", source: "https://example.test/research", source_type: "web" } },
  { id: "memory", props: { label: "Writing preference", source: "3f2504e0-4f89-41d3-9a0c-0305e82c3301", source_type: "memory" } },
  { id: "long_content", props: { label: longLabel, source: "https://example.test/research", source_type: "web" } },
] } as const;
