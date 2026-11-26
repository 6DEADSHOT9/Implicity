// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";
import { WidgetPicker } from "./WidgetPicker";

describe("WidgetPicker", () => {
  it("validates and renders every declared gallery state with its slot content", () => {
    const entry = registry.getSkeleton("WidgetPicker")!;
    for (const state of entry.meta.galleryStates) {
      expect(propsSchema.safeParse(state.props).success).toBe(true);
      expect(propsSchema.safeParse({ ...state.props, unexpected: true }).success).toBe(false);
      expect(slotsSchema.safeParse(state.slots).success).toBe(true);
      expect(entry.schema.safeParse({ props: state.props, slots: state.slots }).success).toBe(true);
      const recorder = recordingCapture();
      const slotIds = state.slots?.widgets ?? [];
      const content = slotIds.map((id) => <span key={id}>{id}</span>);
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={{widgets: content}} /></CaptureProvider>);
      if (slotIds.length && state.props.open) {
        for (const id of slotIds) expect(document.body.textContent).toContain(id);
      }
      const defaultState = state.props.open ? "open" : "closed";
      expect(recorder.events[0]).toEqual({ name: "component_shown", component: "WidgetPicker", default_state: defaultState });
      view.unmount();
    }
  });
  it("returns focus to Customize when Escape closes the dialog", async () => {
    function ControlledPicker() {
      const [open, setOpen] = useState(false);
      return <WidgetPicker open={open} title="Add widgets" enabled onOpenChange={setOpen} />;
    }
    const user = userEvent.setup();
    render(<ControlledPicker />);
    const trigger = screen.getByRole("button", { name: "Customize" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Add widgets" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(trigger);
  });
  it("emits picker panel events only when its controlled state changes", () => {
    const recorder = recordingCapture();
    const view = render(<CaptureProvider sink={recorder.sink}><WidgetPicker open={false} title="Add widgets" enabled /></CaptureProvider>);
    expect(recorder.events.map(({ name }) => name)).toEqual(["component_shown"]);
    view.rerender(<CaptureProvider sink={recorder.sink}><WidgetPicker open title="Add widgets" enabled /></CaptureProvider>);
    expect(recorder.events.at(-1)).toEqual({ name: "panel_opened", component: "WidgetPicker" });
    view.rerender(<CaptureProvider sink={recorder.sink}><WidgetPicker open={false} title="Add widgets" enabled /></CaptureProvider>);
    expect(recorder.events.at(-1)).toEqual({ name: "panel_closed", component: "WidgetPicker" });
  });
  it("requires two unique heading ids", () => {
    const props = { ...meta.galleryStates[0].props, open: true } as React.ComponentProps<typeof WidgetPicker>;
    render(<><WidgetPicker {...props} /><WidgetPicker {...props} /></>);
    const ids = Array.from(document.querySelectorAll("h1, h2")).map((heading) => heading.id);
    expect(ids).toHaveLength(2);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });
});
