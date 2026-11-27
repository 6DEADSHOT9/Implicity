// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
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
      if (props.widgets.length) {
        expect(propsSchema.safeParse({ ...state.props, widgets: [props.widgets[0], { ...props.widgets[0], widgetId: props.widgets[0].widgetId }] }).success).toBe(false);
      }
      expect(entry.schema.safeParse({ props: state.props, slots: {} }).success).toBe(true);
      const recorder = recordingCapture();
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={{}} /></CaptureProvider>);
      if (state.props.open) {
        expect(screen.getAllByRole("switch")).toHaveLength(props.widgets.length);
        for (const widget of props.widgets) expect(screen.getByRole("switch", { name: widget.label })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Add Data table" })).toBeTruthy();
      } else {
        expect(screen.getByText("Customize")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Customize" })).toBeNull();
      }
      const defaultState = props.open ? "open" : "closed";
      expect(recorder.events[0]).toEqual({ name: "component_shown", component: "WidgetPicker", default_state: defaultState });
      expect(recorder.events.map(({ name }) => name)).toEqual(["component_shown"]);
      view.unmount();
    }
  });

  it("records each accepted Switch change once, including switching back on", async () => {
    const recorder = recordingCapture();
    const user = userEvent.setup();
    const props = meta.galleryStates[1].props;

    function AcceptingPicker() {
      const [widgets, setWidgets] = useState(props.widgets);
      return <WidgetPicker {...props} widgets={widgets} onWidgetChange={(id, enabled) => setWidgets((current) => current.map((widget) => widget.widgetId === id ? { ...widget, enabled } : widget))} />;
    }

    render(<CaptureProvider sink={recorder.sink}><AcceptingPicker /></CaptureProvider>);
    expect(recorder.events.map(({ name }) => name)).toEqual(["component_shown"]);
    await user.click(screen.getByRole("switch", { name: "Resume" }));
    expect(screen.getByRole("switch", { name: "Resume" }).getAttribute("aria-checked")).toBe("false");
    await user.click(screen.getByRole("switch", { name: "Resume" }));
    expect(screen.getByRole("switch", { name: "Resume" }).getAttribute("aria-checked")).toBe("true");
    expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([
      { name: "setting_changed", dimension: "home_widgets", value: "off", component: "ResumeWidget" },
      { name: "setting_changed", dimension: "home_widgets", value: "on", component: "ResumeWidget" },
    ]);
  });

  it("distinguishes widgets that share a component and ignores app-driven changes", async () => {
    const recorder = recordingCapture();
    const user = userEvent.setup();
    const original = [
      { widgetId: "supplier-a", componentId: "DataTable", label: "Supplier A", enabled: true },
      { widgetId: "supplier-b", componentId: "DataTable", label: "Supplier B", enabled: true },
    ];
    const onWidgetChange = vi.fn();
    let setAppChange: () => void = () => {};
    let rerenderUnchanged: () => void = () => {};

    function Parent() {
      const [widgets, setWidgets] = useState(original);
      const [, rerender] = useState(0);
      setAppChange = () => setWidgets((current) => current.map((widget) => widget.widgetId === "supplier-b" ? { ...widget, enabled: false } : widget));
      rerenderUnchanged = () => rerender((value) => value + 1);
      return <>
        <WidgetPicker open title="Choose Home widgets" widgets={[...widgets]} availableWidgets={[]} onOpenChange={() => undefined} onWidgetChange={(id, enabled) => {
          onWidgetChange(id, enabled);
          setWidgets((current) => current.map((widget) => widget.widgetId === id ? { ...widget, enabled } : widget));
        }} />
      </>;
    }

    render(<CaptureProvider sink={recorder.sink}><Parent /></CaptureProvider>);
    act(() => setAppChange());
    expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([]);
    act(() => rerenderUnchanged());
    expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([]);
    await user.click(screen.getByRole("switch", { name: "Supplier A" }));
    await user.click(screen.getByRole("switch", { name: "Supplier B" }));
    expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([
      { name: "setting_changed", dimension: "home_widgets", value: "off", component: "DataTable" },
      { name: "setting_changed", dimension: "home_widgets", value: "on", component: "DataTable" },
    ]);
    expect(onWidgetChange.mock.calls).toEqual([["supplier-a", false], ["supplier-b", true]]);
    act(() => rerenderUnchanged());
    expect(recorder.events.filter(({ name }) => name === "setting_changed")).toHaveLength(2);
  });

  it("does not record a parent update on a closed picker", async () => {
    const recorder = recordingCapture();
    const props = meta.galleryStates[0].props;
    const widgets = [{ widgetId: "home_resume", componentId: "ResumeWidget", label: "Resume", enabled: true }];
    const view = render(<CaptureProvider sink={recorder.sink}><WidgetPicker {...props} widgets={widgets} /></CaptureProvider>);
    view.rerender(<CaptureProvider sink={recorder.sink}><WidgetPicker {...props} widgets={[{ ...widgets[0], enabled: false }]} /></CaptureProvider>);
    expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([]);
  });

  it("does not record a widget change refused by the parent", async () => {
    const recorder = recordingCapture();
    let appChange: () => void = () => {};
    const user = userEvent.setup();
    const initial = meta.galleryStates[1].props.widgets;
    function RefusingParent() {
      const [widgets, setWidgets] = useState(initial);
      appChange = () => setWidgets((current) => current.map((widget) => widget.widgetId === "home_resume" ? { ...widget, enabled: false } : widget));
      return <WidgetPicker {...meta.galleryStates[1].props} widgets={widgets} onWidgetChange={() => undefined} />;
    }
    render(<CaptureProvider sink={recorder.sink}><RefusingParent /></CaptureProvider>);

    await user.click(screen.getByRole("switch", { name: "Resume" }));
    expect(screen.getByRole("switch", { name: "Resume" }).getAttribute("aria-checked")).toBe("true");
    act(() => appChange());
    expect(screen.getByRole("switch", { name: "Resume" }).getAttribute("aria-checked")).toBe("false");
    expect(recorder.events.map(({ name }) => name)).toEqual(["component_shown"]);
  });

  it("passes the selected available widget id to onAdd", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<WidgetPicker {...meta.galleryStates[1].props} onAdd={onAdd} />);
    await user.click(screen.getByRole("button", { name: "Add Data table" }));
    expect(onAdd).toHaveBeenCalledWith("supplier_watch");
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
    render(<><WidgetPicker {...props} onOpenChange={() => undefined} /><WidgetPicker {...props} onOpenChange={() => undefined} /></>);
    const ids = Array.from(document.querySelectorAll("h1, h2")).map((heading) => heading.id);
    expect(ids).toHaveLength(2);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });
});
