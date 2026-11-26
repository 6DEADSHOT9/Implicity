// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { AppShell } from "./AppShell";
import { propsSchema, slotsSchema } from "./schema";

afterEach(cleanup);

describe("AppShell", () => {
  const entry = registry.getSkeleton("AppShell")!;
  it("validates and renders every declared gallery state through the registry interface", () => {
    for (const state of entry.meta.galleryStates) {
      const slots = Object.fromEntries(Object.entries(state.slots ?? {}).map(([slot, content]) => [slot, content]));
      expect(entry.schema.safeParse({ props: state.props, slots }).success, state.id).toBe(true);
      const recorder = recordingCapture();
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={slots} /></CaptureProvider>);
      expect(view.getByRole("main")).toBeTruthy(); expect(view.getByRole("navigation", { name: "Workspace navigation" })).toBeTruthy();
      expect(recorder.events).toContainEqual({ name: "component_shown", component: "AppShell", default_state: state.id });
      view.unmount();
    }
  });
  it("emits panel events only after the controlled display changes", () => {
    const recorder = recordingCapture();
    const onPanelOpenChange = vi.fn();
    const view = render(<CaptureProvider sink={recorder.sink}><AppShell panelOpen={false} onPanelOpenChange={onPanelOpenChange} /></CaptureProvider>);
    act(() => view.rerender(<CaptureProvider sink={recorder.sink}><AppShell panelOpen={true} onPanelOpenChange={onPanelOpenChange} /></CaptureProvider>));
    expect(recorder.events).toContainEqual({ name: "panel_opened", component: "AppShell" });
    expect(onPanelOpenChange).not.toHaveBeenCalled();
    view.getByRole("button", { name: "Close panel" }).click();
    expect(onPanelOpenChange).toHaveBeenCalledWith(false);
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
