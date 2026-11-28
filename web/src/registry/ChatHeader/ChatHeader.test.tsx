// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { propsSchema, slotsSchema } from "./schema";
import { ChatHeader } from "./ChatHeader";

afterEach(cleanup);

describe("ChatHeader", () => {
  const entry = registry.getSkeleton("ChatHeader")!;
  it("validates and renders every declared gallery state through the registry interface", () => {
    for (const state of entry.meta.galleryStates) {
      const slots = state.slots ?? {};
      expect(entry.schema.safeParse({ props: state.props, slots }).success, state.id).toBe(true);
      const recorder = recordingCapture();
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={slots} /></CaptureProvider>);
      if (state.id === "with-settings") expect(view.getByRole("menuitem", { name: "Conversation settings" })).toBeTruthy();
      else { expect(view.getByRole("heading", { level: 1 })).toBeTruthy(); expect(view.getByRole("button", { name: "Conversation settings" })).toBeTruthy(); }
      expect(recorder.events).toContainEqual({ name: "component_shown", component: "ChatHeader", default_state: state.id });
      view.unmount();
    }
  });
  it("opens app settings once on selection and never on dismissal", async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    const onSettingsOpenChange = vi.fn();
    const view = render(<CaptureProvider sink={recordingCapture().sink}><ChatHeader title="Chat" kind="coding" settingsOpen={false} onOpenSettings={onOpenSettings} onSettingsOpenChange={onSettingsOpenChange} /></CaptureProvider>);
    await user.click(screen.getByRole("button", { name: "Conversation settings" }));
    view.rerender(<CaptureProvider sink={recordingCapture().sink}><ChatHeader title="Chat" kind="coding" settingsOpen onOpenSettings={onOpenSettings} onSettingsOpenChange={onSettingsOpenChange} /></CaptureProvider>);
    await user.click(screen.getByRole("menuitem", { name: "Conversation settings" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onSettingsOpenChange.mock.calls).toEqual([[true], [false]]);
    view.rerender(<CaptureProvider sink={recordingCapture().sink}><ChatHeader title="Chat" kind="coding" settingsOpen={false} onOpenSettings={onOpenSettings} onSettingsOpenChange={onSettingsOpenChange} /></CaptureProvider>);
    await user.click(screen.getByRole("button", { name: "Conversation settings" }));
    view.rerender(<CaptureProvider sink={recordingCapture().sink}><ChatHeader title="Chat" kind="coding" settingsOpen onOpenSettings={onOpenSettings} onSettingsOpenChange={onSettingsOpenChange} /></CaptureProvider>);
    await user.keyboard("{Escape}");
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onSettingsOpenChange.mock.calls).toEqual([[true], [false], [true], [false]]);
  });
  it("omits the kind badge when the host does not know a chat kind yet", () => {
    render(<CaptureProvider sink={recordingCapture().sink}><ChatHeader title="New chat" /></CaptureProvider>);
    expect(screen.getByRole("heading", { name: "New chat" })).toBeTruthy();
    expect(screen.queryByText("coding")).toBeNull();
  });
  it("exports strict props and slots schemas", () => {
    expect(propsSchema.safeParse(entry.meta.galleryStates[0].props).success).toBe(true);
    expect(propsSchema.safeParse({ ...entry.meta.galleryStates[0].props, unexpected: true }).success).toBe(false);
    expect(slotsSchema.safeParse({}).success).toBe(true);
    expect(slotsSchema.safeParse({ unexpected: [] }).success).toBe(false);
    expect(entry.events).toContain("component_shown");
    expect(entry.events).toContain("component_seen");
  });
});
