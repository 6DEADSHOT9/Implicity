// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { registry } from "..";
import { CaptureProvider, createValidatedCapture, recordingCapture } from "../capture";
import { ShortcutChips } from "./ShortcutChips";
import { meta } from "./meta";
import { propsSchema } from "./schema";

describe("ShortcutChips", () => {
  it("renders labeled commands and passes the stable id to its callback", async () => {
    expect(propsSchema.safeParse(meta.galleryStates[0].props).success).toBe(true); const onCommand = vi.fn(); const user = userEvent.setup();
    const capture = recordingCapture();
    render(<CaptureProvider sink={capture.sink}><ShortcutChips {...meta.galleryStates[0].props} onCommand={onCommand} /></CaptureProvider>); await user.click(screen.getByRole("button", { name: "Copy answer" })); expect(onCommand).toHaveBeenCalledWith("copy_answer");
    expect(capture.events).toContainEqual({ name: "shortcut_used", command: "copy_answer" });
    expect(propsSchema.safeParse({ commands: [{ id: "not valid", label: "Try" }] }).success).toBe(false);
    expect(propsSchema.safeParse({ commands: [{ id: "try", label: "Try" }, { id: "try", label: "Try again" }] }).success).toBe(false);
    expect(propsSchema.safeParse({ commands: [{ id: "cmd_my-secret-project", label: "Try" }] }).success).toBe(false);
    expect(propsSchema.safeParse({ commands: [{ id: "cmd_123", label: "Try" }] }).success).toBe(false);
    expect(propsSchema.safeParse({ commands: [{ id: "cmd_123e4567-e89b-42d3-a456-426614174000", label: "App command" }] }).success).toBe(true);
  });

  it("sends shortcut_used for a built-in chip through the real validator and registry", async () => {
    const send = vi.fn();
    const sink = createValidatedCapture({ context: { session_id: "123e4567-e89b-42d3-a456-426614174000", layout_version: 1 }, registry, send, ids: { has: () => false } });
    const user = userEvent.setup();
    render(<CaptureProvider sink={sink}><ShortcutChips commands={[{ id: "search", label: "Search" }, { id: "copy_answer", label: "Copy answer" }]} /></CaptureProvider>);
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(screen.getByRole("button", { name: "Copy answer" }));
    const used = send.mock.calls.map(([event]) => event).filter(({ name }) => name === "shortcut_used");
    expect(used.map(({ command }) => command)).toEqual(["search", "copy_answer"]);
    expect(used[0]).toMatchObject({ registry_version: registry.version, session_id: "123e4567-e89b-42d3-a456-426614174000" });
  });
});
