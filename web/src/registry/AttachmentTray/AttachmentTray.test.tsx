// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttachmentTray } from "./AttachmentTray";
import { meta } from "./meta";
import { propsSchema } from "./schema";

describe("AttachmentTray", () => {
  it("renders empty and populated gallery states without dropping labels", () => {
    for (const state of meta.galleryStates) { expect(propsSchema.safeParse(state.props).success).toBe(true); const view = render(<AttachmentTray {...state.props} />); expect(screen.getByRole("group", { name: "Attachments" })).toBeTruthy(); view.unmount(); }
    render(<AttachmentTray attachments={[{ id: "file", name: "https://example.test/a-very-long-file-name", type: "document" }]} />); expect(screen.getByText("https://example.test/a-very-long-file-name")).toBeTruthy();
    expect(propsSchema.safeParse({ attachments: [{ id: "file", name: "x", type: "script" }] }).success).toBe(false);
    expect(propsSchema.safeParse({ attachments: [{ id: "same", name: "First", type: "other" }, { id: "same", name: "Second", type: "other" }] }).success).toBe(false);
  });
});
