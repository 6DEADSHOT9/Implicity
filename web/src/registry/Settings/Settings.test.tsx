// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { propsSchema, slotsSchema } from "./schema";
import { Settings as SettingsComponent } from "./Settings";

afterEach(cleanup);

describe("Settings", () => {
  const entry = registry.getSkeleton("Settings")!;
  it("validates and renders every declared gallery state through the registry interface", () => {
    for (const state of entry.meta.galleryStates) {
      const slots = state.slots ?? {};
      expect(entry.schema.safeParse({ props: state.props, slots }).success, state.id).toBe(true);
      const recorder = recordingCapture();
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={slots} /></CaptureProvider>);
      expect(view.getByRole("dialog", { name: "Settings" })).toBeTruthy(); expect(view.getByRole("tablist")).toBeTruthy();
      expect(view.getByRole("tab", { selected: true }).getAttribute("data-state")).toBe("active");
      expect(view.getByText(`${state.id}_content`)).toBeTruthy();
      expect(recorder.events).toContainEqual({ name: "component_shown", component: "Settings", default_state: state.id });
      view.unmount();
    }
  });
  it("uses a modal dialog and reports tab changes and close requests", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    const onClose = vi.fn();
    render(<CaptureProvider sink={recordingCapture().sink}><SettingsComponent open tab="preferences" onTabChange={onTabChange} onClose={onClose} /></CaptureProvider>);
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: "Quota" }));
    expect(onTabChange).toHaveBeenCalledWith("quota");
    await user.click(screen.getByRole("button", { name: "Close settings" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("returns keyboard focus to the application opener on close", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return <><button type="button" onClick={() => setOpen(true)}>Open app settings</button><SettingsComponent open={open} tab="preferences" onClose={() => setOpen(false)} /></>;
    }
    render(<CaptureProvider sink={recordingCapture().sink}><Harness /></CaptureProvider>);
    const opener = screen.getByRole("button", { name: "Open app settings" });
    await user.click(opener);
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(opener);
  });
  it("declares every tab as a default state", () => {
    expect(entry.meta.defaultStates).toEqual(entry.meta.galleryStates.map(({ id }) => id));
    for (const tab of ["preferences", "locks", "notices", "history", "quota"]) {
      expect(entry.meta.defaultStates).toContain(tab);
      expect(entry.schema.safeParse({ props: { open: true, tab }, slots: {} }).success).toBe(true);
    }
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
