// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { propsSchema, slotsSchema } from "./schema";
import { Composer } from "./Composer";

afterEach(cleanup);

describe("Composer", () => {
  const entry = registry.getSkeleton("Composer")!;
  it("validates and renders every declared gallery state through the registry interface", () => {
    for (const state of entry.meta.galleryStates) {
      const slots = state.slots ?? {};
      expect(entry.schema.safeParse({ props: state.props, slots }).success, state.id).toBe(true);
      const recorder = recordingCapture();
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={slots} /></CaptureProvider>);
      expect(view.getByRole("textbox", { name: "Message" })).toBeTruthy(); expect(view.getByRole("button", { name: "Submit" })).toBeTruthy();
      expect(view.getByRole("button", { name: "Add attachment" })).toBeTruthy();
      expect(recorder.events).toContainEqual({ name: "component_shown", component: "Composer", default_state: state.id });
      view.unmount();
    }
  });
  it("shows, removes, reports, and submits selected files and shortcut ids", async () => {
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:file"), revokeObjectURL: vi.fn() });
    const user = userEvent.setup();
    const recorder = recordingCapture();
    const onSubmit = vi.fn();
    const onAttachmentsChange = vi.fn();
    const onShortcut = vi.fn();
    render(<CaptureProvider sink={recorder.sink}><Composer attachments={[]} shortcuts={[{ id: "cmd_550e8400-e29b-41d4-a716-446655440010", label: "Summarize" }]} onSubmit={onSubmit} onAttachmentsChange={onAttachmentsChange} onShortcut={onShortcut} /></CaptureProvider>);
    await user.click(screen.getByRole("button", { name: "Add attachment" }));
    await user.click(screen.getByRole("menuitem", { name: "Add photos or files" }));
    const file = new File(["private"], "secret-plan.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Upload files"), { target: { files: [file] } });
    expect(await screen.findByText("secret-plan.pdf")).toBeTruthy();
    expect(onAttachmentsChange).toHaveBeenLastCalledWith([expect.objectContaining({ filename: "secret-plan.pdf" })]);
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Remove secret-plan.pdf" }));
    expect(screen.queryByText("secret-plan.pdf")).toBeNull();
    expect(onAttachmentsChange).toHaveBeenLastCalledWith([]);
    await user.click(screen.getByRole("button", { name: "Add attachment" }));
    await user.click(screen.getByRole("menuitem", { name: "Add photos or files" }));
    fireEvent.change(screen.getByLabelText("Upload files"), { target: { files: [file] } });
    await user.keyboard("{Escape}");
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Draft");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ text: "Draft", files: [expect.objectContaining({ filename: "secret-plan.pdf" })] }));
    await user.click(screen.getByRole("button", { name: "Summarize" }));
    expect(onShortcut).toHaveBeenCalledWith("cmd_550e8400-e29b-41d4-a716-446655440010");
    expect(recorder.events.filter(({ name }) => name === "shortcut_used")).toEqual([{ name: "shortcut_used", command: "cmd_550e8400-e29b-41d4-a716-446655440010" }]);
  });
  it("exports strict props and slots schemas", () => {
    expect(propsSchema.safeParse(entry.meta.galleryStates[0].props).success).toBe(true);
    expect(propsSchema.safeParse({ ...entry.meta.galleryStates[0].props, unexpected: true }).success).toBe(false);
    expect(slotsSchema.safeParse({}).success).toBe(true);
    expect(slotsSchema.safeParse({ unexpected: [] }).success).toBe(false);
    expect(entry.events).toContain("component_shown");
    expect(entry.events).toContain("component_seen");
  });
  it("accepts declared built-in and app-minted workflow Commands only, without duplicate ids", () => {
    const builtIn = "search";
    const workflow = "cmd_550e8400-e29b-41d4-a716-446655440010";
    expect(propsSchema.safeParse({ attachments: [], shortcuts: [{ id: builtIn, label: "Search" }, { id: workflow, label: "Summarize" }] }).success).toBe(true);
    for (const id of ["unknown_command", "cmd_not_a_uuid"]) {
      expect(propsSchema.safeParse({ attachments: [], shortcuts: [{ id, label: "Unknown" }] }).success, id).toBe(false);
    }
    expect(propsSchema.safeParse({ attachments: [], shortcuts: [{ id: "search", label: "A" }, { id: "search", label: "B" }] }).success).toBe(false);
  });
});
