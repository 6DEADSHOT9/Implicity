// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { describe, expect, it } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";
import { WidgetPicker } from "./WidgetPicker";

describe("WidgetPicker", () => {
  it("validates and renders every declared gallery state through the registry", () => {
    const entry = registry.getSkeleton("WidgetPicker")!;
    for (const state of entry.meta.galleryStates) {
      expect(propsSchema.safeParse(state.props).success).toBe(true);
      expect(propsSchema.safeParse({ ...state.props, unknown: true }).success).toBe(false);
      expect(slotsSchema.safeParse(state.slots).success).toBe(true);
      expect(entry.schema.safeParse({ props: state.props, slots: state.slots }).success).toBe(true);
      const recorder = recordingCapture();
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={{widgets: <span key="example_content">example_content</span>}} /></CaptureProvider>);
      expect(document.body.textContent).toContain("Customize Home");
      expect(recorder.events[0]).toEqual({ name: "component_shown", component: "WidgetPicker", default_state: "closed" });
      view.unmount();
    }
  });
  it("calls the owner on activation and emits panel events only when displayed state changes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const recorder = recordingCapture();
    const view = render(<CaptureProvider sink={recorder.sink}><WidgetPicker open={false} title="Add widgets" onOpenChange={onOpenChange} /></CaptureProvider>);
    await user.click(screen.getByRole("button", { name: "Customize Home" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(recorder.events.map(({ name }) => name)).toEqual(["component_shown"]);
    view.rerender(<CaptureProvider sink={recorder.sink}><WidgetPicker open title="Add widgets" onOpenChange={onOpenChange} /></CaptureProvider>);
    expect(screen.getByRole("dialog", { name: "Add widgets" })).toBeTruthy();
    expect(recorder.events.at(-1)).toEqual({ name: "panel_opened", component: "WidgetPicker" });
  });
  it("rejects unknown props and gives each heading a unique id", () => {
    expect(propsSchema.safeParse({ ...meta.galleryStates[0].props, unknown: true }).success).toBe(false);
    render(<><WidgetPicker {...meta.galleryStates[0].props as React.ComponentProps<typeof WidgetPicker>} slots={{widgets: <span key="content">Content</span>}} /><WidgetPicker {...meta.galleryStates[0].props as React.ComponentProps<typeof WidgetPicker>} slots={{widgets: <span key="content">Content</span>}} /></>);
    const ids = Array.from(document.querySelectorAll("h1, h2, [role=dialog] [id]")).map(node => node.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
