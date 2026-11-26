// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { meta } from "./meta";
import { propsSchema } from "./schema";
import { WidgetPicker } from "./WidgetPicker";

describe("WidgetPicker", () => {
  it("validates and renders every declared gallery state", () => {
    const entry = registry.getSkeleton("WidgetPicker")!;
    for (const state of entry.meta.galleryStates) {
      const props = state.props as React.ComponentProps<typeof WidgetPicker>;
      expect(propsSchema.safeParse(state.props).success).toBe(true);
      expect(propsSchema.safeParse({ ...state.props, unexpected: true }).success).toBe(false);
      expect(entry.schema.safeParse({ props: state.props, slots: {} }).success).toBe(true);
      const recorder = recordingCapture();
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={{}} /></CaptureProvider>);
      if (state.props.open) {
        expect(screen.getAllByRole("switch")).toHaveLength(props.widgets.length);
        for (const widget of props.widgets) expect(screen.getByRole("switch", { name: widget.label })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Add Data table" })).toBeTruthy();
      } else {
        expect(screen.getByRole("button", { name: "Customize" })).toBeTruthy();
      }
      const defaultState = props.open ? "open" : "closed";
      expect(recorder.events[0]).toEqual({ name: "component_shown", component: "WidgetPicker", default_state: defaultState });
      expect(recorder.events.map(({ name }) => name)).toEqual(["component_shown"]);
      view.unmount();
    }
  });

  it("records only actual widget state changes and calls the owner with its component id", async () => {
    const recorder = recordingCapture();
    const onWidgetChange = vi.fn();
    const user = userEvent.setup();
    const props = meta.galleryStates[1].props;
    render(<CaptureProvider sink={recorder.sink}><WidgetPicker {...props} widgets={props.widgets.map((widget) => widget.id === "NowPlayingWidget" ? { ...widget, enabled: false } : widget)} onWidgetChange={onWidgetChange} /></CaptureProvider>);
    await user.click(screen.getByRole("switch", { name: "Resume" }));
    await user.click(screen.getByRole("switch", { name: "Now playing" }));
    expect(onWidgetChange).toHaveBeenCalledWith("ResumeWidget", false);
    expect(onWidgetChange).toHaveBeenCalledWith("NowPlayingWidget", true);
    expect(recorder.events).toContainEqual({ name: "setting_changed", dimension: "home_widgets", value: "off", component: "ResumeWidget" });
    expect(recorder.events).toContainEqual({ name: "setting_changed", dimension: "home_widgets", value: "on", component: "NowPlayingWidget" });
  });

  it("passes the selected available widget id to onAdd", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<WidgetPicker {...meta.galleryStates[1].props} onAdd={onAdd} />);
    await user.click(screen.getByRole("button", { name: "Add Data table" }));
    expect(onAdd).toHaveBeenCalledWith("DataTable");
  });

  it("returns focus to Customize when Escape closes the dialog", async () => {
    function ControlledPicker() {
      const [open, setOpen] = useState(false);
      return <WidgetPicker {...meta.galleryStates[0].props} open={open} onOpenChange={setOpen} />;
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
    const props = meta.galleryStates[0].props;
    const view = render(<CaptureProvider sink={recorder.sink}><WidgetPicker {...props} /></CaptureProvider>);
    expect(recorder.events.map(({ name }) => name)).toEqual(["component_shown"]);
    view.rerender(<CaptureProvider sink={recorder.sink}><WidgetPicker {...props} open /></CaptureProvider>);
    expect(recorder.events.at(-1)).toEqual({ name: "panel_opened", component: "WidgetPicker" });
    view.rerender(<CaptureProvider sink={recorder.sink}><WidgetPicker {...props} open={false} /></CaptureProvider>);
    expect(recorder.events.at(-1)).toEqual({ name: "panel_closed", component: "WidgetPicker" });
  });

  it("requires unique heading ids", () => {
    const props = { ...meta.galleryStates[0].props, open: true };
    render(<><WidgetPicker {...props} /><WidgetPicker {...props} /></>);
    const ids = Array.from(document.querySelectorAll("h1, h2")).map((heading) => heading.id);
    expect(ids).toHaveLength(2);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });
});
