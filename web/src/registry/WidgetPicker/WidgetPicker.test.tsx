// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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
      return <WidgetPicker {...props} widgets={widgets} onWidgetChange={(id, enabled) => {
        setWidgets((current) => current.map((widget) => widget.widgetId === id ? { ...widget, enabled } : widget));
        return true;
      }} />;
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
          return true;
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
      return <WidgetPicker {...meta.galleryStates[1].props} widgets={widgets} onWidgetChange={() => false} />;
    }
    render(<CaptureProvider sink={recorder.sink}><RefusingParent /></CaptureProvider>);

    await user.click(screen.getByRole("switch", { name: "Resume" }));
    expect(screen.getByRole("switch", { name: "Resume" }).getAttribute("aria-checked")).toBe("true");
    act(() => appChange());
    expect(screen.getByRole("switch", { name: "Resume" }).getAttribute("aria-checked")).toBe("false");
    expect(recorder.events.map(({ name }) => name)).toEqual(["component_shown"]);
  });

  it("records an accepted change when the parent shows it after a 50 ms save", async () => {
    const recorder = recordingCapture();
    const props = meta.galleryStates[1].props;
    function Parent() {
      const [widgets, setWidgets] = useState(props.widgets);
      return <WidgetPicker {...props} widgets={widgets} onWidgetChange={(id, enabled) => {
        window.setTimeout(() => setWidgets((current) => current.map((widget) => widget.widgetId === id ? { ...widget, enabled } : widget)), 50);
        return true;
      }} />;
    }
    const user = userEvent.setup();
    render(<CaptureProvider sink={recorder.sink}><Parent /></CaptureProvider>);
    await user.click(screen.getByRole("switch", { name: "Resume" }));
    expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([]);
    await waitFor(() => expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([
      { name: "setting_changed", dimension: "home_widgets", value: "off", component: "ResumeWidget" },
    ]));
  });

  it("records an accepted resolved promise after the prop update", async () => {
    const recorder = recordingCapture();
    const props = meta.galleryStates[1].props;
    function Parent() {
      const [widgets, setWidgets] = useState(props.widgets);
      return <WidgetPicker {...props} widgets={widgets} onWidgetChange={async (id, enabled) => {
        setWidgets((current) => current.map((widget) => widget.widgetId === id ? { ...widget, enabled } : widget));
        return true;
      }} />;
    }
    const user = userEvent.setup();
    render(<CaptureProvider sink={recorder.sink}><Parent /></CaptureProvider>);
    await user.click(screen.getByRole("switch", { name: "Resume" }));
    await waitFor(() => expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([
      { name: "setting_changed", dimension: "home_widgets", value: "off", component: "ResumeWidget" },
    ]));
  });

  it("does not record an accepted change the parent never shows", async () => {
    const recorder = recordingCapture();
    const user = userEvent.setup();
    render(<CaptureProvider sink={recorder.sink}><WidgetPicker {...meta.galleryStates[1].props} onWidgetChange={() => true} /></CaptureProvider>);
    await user.click(screen.getByRole("switch", { name: "Resume" }));
    expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([]);
  });

  it("keeps an accepted request through a parent re-render while it is pending", async () => {
    const recorder = recordingCapture();
    const props = meta.galleryStates[1].props;
    function Parent() {
      const [widgets, setWidgets] = useState(props.widgets);
      const [, rerender] = useState(0);
      return <WidgetPicker {...props} widgets={widgets} onWidgetChange={(id, enabled) => new Promise((resolve) => {
        rerender((value) => value + 1);
        window.setTimeout(() => {
          setWidgets((current) => current.map((widget) => widget.widgetId === id ? { ...widget, enabled } : widget));
          resolve(true);
        }, 50);
      })} />;
    }
    const user = userEvent.setup();
    render(<CaptureProvider sink={recorder.sink}><Parent /></CaptureProvider>);
    await user.click(screen.getByRole("switch", { name: "Resume" }));
    await waitFor(() => expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([
      { name: "setting_changed", dimension: "home_widgets", value: "off", component: "ResumeWidget" },
    ]));
  });

  it("records two accepted quick moves on the same widget", async () => {
    const recorder = recordingCapture();
    const props = meta.galleryStates[1].props;
    function Parent() {
      const [widgets, setWidgets] = useState(props.widgets);
      return <WidgetPicker {...props} widgets={widgets} onWidgetChange={(id, enabled) => new Promise((resolve) => {
        window.setTimeout(() => setWidgets((current) => current.map((widget) => widget.widgetId === id ? { ...widget, enabled } : widget)), 10);
        window.setTimeout(() => resolve(true), 60);
      })} />;
    }
    const user = userEvent.setup();
    render(<CaptureProvider sink={recorder.sink}><Parent /></CaptureProvider>);
    const resume = screen.getByRole("switch", { name: "Resume" });
    await user.click(resume);
    await waitFor(() => expect(resume.getAttribute("aria-checked")).toBe("false"));
    await user.click(resume);
    await waitFor(() => expect(resume.getAttribute("aria-checked")).toBe("true"));
    await waitFor(() => expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([
      { name: "setting_changed", dimension: "home_widgets", value: "off", component: "ResumeWidget" },
      { name: "setting_changed", dimension: "home_widgets", value: "on", component: "ResumeWidget" },
    ]));
  });

  it("settles every same-value request when the parent shows it once", async () => {
    const recorder = recordingCapture();
    const props = meta.galleryStates[1].props;
    const answers: Array<(accepted: boolean) => void> = [];
    let show: (enabled: boolean) => void = () => {};
    function Parent() {
      const [widgets, setWidgets] = useState(props.widgets);
      show = (enabled) => setWidgets((current) => current.map((widget) => ({ ...widget, enabled })));
      return <>
        <WidgetPicker {...props} widgets={widgets} onWidgetChange={() => new Promise((resolve) => answers.push(resolve))} />
        <button onClick={() => show(false)}>Show off</button>
        <button onClick={() => show(true)}>App on</button>
        <button onClick={() => show(false)}>App off</button>
      </>;
    }
    const user = userEvent.setup();
    render(<CaptureProvider sink={recorder.sink}><Parent /></CaptureProvider>);
    const resume = screen.getByRole("switch", { name: "Resume" });
    await user.click(resume);
    await user.click(resume);
    expect(answers).toHaveLength(2);
    act(() => answers.forEach((resolve) => resolve(true)));
    await user.click(screen.getByRole("button", { name: "Show off" }));
    await waitFor(() => expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([
      { name: "setting_changed", dimension: "home_widgets", value: "off", component: "ResumeWidget" },
    ]));
    await user.click(screen.getByRole("button", { name: "App on" }));
    await user.click(screen.getByRole("button", { name: "App off" }));
    expect(recorder.events.filter(({ name }) => name === "setting_changed")).toHaveLength(1);
  });

  it("ignores later answers after one accepted shown value settles the requests", async () => {
    const recorder = recordingCapture();
    const props = meta.galleryStates[1].props;
    const answers: Array<(accepted: boolean) => void> = [];
    let showOff: () => void = () => {};
    function Parent() {
      const [widgets, setWidgets] = useState(props.widgets);
      showOff = () => setWidgets((current) => current.map((widget) => ({ ...widget, enabled: false })));
      return <>
        <WidgetPicker {...props} widgets={widgets} onWidgetChange={() => new Promise((resolve) => answers.push(resolve))} />
        <button onClick={showOff}>Show off</button>
      </>;
    }
    const user = userEvent.setup();
    render(<CaptureProvider sink={recorder.sink}><Parent /></CaptureProvider>);
    const resume = screen.getByRole("switch", { name: "Resume" });
    await user.click(resume);
    await user.click(resume);
    act(() => answers[0](true));
    await user.click(screen.getByRole("button", { name: "Show off" }));
    await waitFor(() => expect(recorder.events.filter(({ name }) => name === "setting_changed")).toHaveLength(1));
    await act(async () => answers[1](true));
    expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([
      { name: "setting_changed", dimension: "home_widgets", value: "off", component: "ResumeWidget" },
    ]);
  });

  it("records the accepted second request when the first never settles", async () => {
    const recorder = recordingCapture();
    const props = meta.galleryStates[1].props;
    let calls = 0;
    let acceptSecond: (accepted: boolean) => void = () => {};
    let showOff: () => void = () => {};
    function Parent() {
      const [widgets, setWidgets] = useState(props.widgets);
      showOff = () => setWidgets((current) => current.map((widget) => ({ ...widget, enabled: false })));
      return <>
        <WidgetPicker {...props} widgets={widgets} onWidgetChange={() => {
          calls += 1;
          return calls === 1 ? new Promise<boolean>(() => {}) : new Promise((resolve) => { acceptSecond = resolve; });
        }} />
        <button onClick={showOff}>Show off</button>
      </>;
    }
    const user = userEvent.setup();
    render(<CaptureProvider sink={recorder.sink}><Parent /></CaptureProvider>);
    const resume = screen.getByRole("switch", { name: "Resume" });
    await user.click(resume);
    await user.click(resume);
    await user.click(screen.getByRole("button", { name: "Show off" }));
    act(() => acceptSecond(true));
    await waitFor(() => expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([
      { name: "setting_changed", dimension: "home_widgets", value: "off", component: "ResumeWidget" },
    ]));
  });

  it("records the accepted second request when the first throws, and lets the error surface", async () => {
    const errors: string[] = [];
    const onError = (event: ErrorEvent) => { errors.push(event.error.message); event.preventDefault(); };
    window.addEventListener("error", onError);
    const recorder = recordingCapture();
    const props = meta.galleryStates[1].props;
    let calls = 0;
    let acceptSecond: (accepted: boolean) => void = () => {};
    let showOff: () => void = () => {};
    function Parent() {
      const [widgets, setWidgets] = useState(props.widgets);
      showOff = () => setWidgets((current) => current.map((widget) => ({ ...widget, enabled: false })));
      return <>
        <WidgetPicker {...props} widgets={widgets} onWidgetChange={() => {
          calls += 1;
          if (calls === 1) throw new Error("save failed");
          return new Promise((resolve) => { acceptSecond = resolve; });
        }} />
        <button onClick={showOff}>Show off</button>
      </>;
    }
    const user = userEvent.setup();
    render(<CaptureProvider sink={recorder.sink}><Parent /></CaptureProvider>);
    const resume = screen.getByRole("switch", { name: "Resume" });
    await user.click(resume);
    await user.click(resume);
    await user.click(screen.getByRole("button", { name: "Show off" }));
    act(() => acceptSecond(true));
    await waitFor(() => expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([
      { name: "setting_changed", dimension: "home_widgets", value: "off", component: "ResumeWidget" },
    ]));
    window.removeEventListener("error", onError);
    expect(errors).toEqual(["save failed"]);
  });

  it("ignores a new unchanged widgets array while an accepted request is pending", async () => {
    const recorder = recordingCapture();
    const props = meta.galleryStates[1].props;
    let showOff: () => void = () => {};
    let resolveSave: (accepted: boolean) => void = () => {};
    function Parent() {
      const [widgets, setWidgets] = useState(props.widgets);
      const [revision, setRevision] = useState(0);
      showOff = () => setWidgets((current) => current.map((widget) => ({ ...widget, enabled: false })));
      return <>
        <WidgetPicker {...props} widgets={widgets} onWidgetChange={() => new Promise((resolve) => { resolveSave = resolve; })} />
        <button onClick={() => { setWidgets((current) => [...current]); setRevision((value) => value + 1); }}>New list {revision}</button>
        <button onClick={showOff}>Show off</button>
      </>;
    }
    const user = userEvent.setup();
    render(<CaptureProvider sink={recorder.sink}><Parent /></CaptureProvider>);
    await user.click(screen.getByRole("switch", { name: "Resume" }));
    await user.click(screen.getByRole("button", { name: "New list 0" }));
    await user.click(screen.getByRole("button", { name: "Show off" }));
    act(() => resolveSave(true));
    await waitFor(() => expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([
      { name: "setting_changed", dimension: "home_widgets", value: "off", component: "ResumeWidget" },
    ]));
  });

  it("does not record a promise refusal or rejection followed by an app change", async () => {
    for (const getResult of [() => Promise.resolve(false), () => Promise.reject(new Error("save failed"))]) {
      const recorder = recordingCapture();
      const props = meta.galleryStates[1].props;
      let appChange: () => void = () => {};
      function Parent() {
        const [widgets, setWidgets] = useState(props.widgets);
        appChange = () => setWidgets((current) => current.map((widget) => ({ ...widget, enabled: false })));
        return <WidgetPicker {...props} widgets={widgets} onWidgetChange={getResult} />;
      }
      const user = userEvent.setup();
      render(<CaptureProvider sink={recorder.sink}><Parent /></CaptureProvider>);
      await user.click(screen.getByRole("switch", { name: "Resume" }));
      await act(async () => { await Promise.resolve(); });
      act(() => appChange());
      expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([]);
      cleanup();
    }
  });

  const off = { name: "setting_changed", dimension: "home_widgets", value: "off", component: "ResumeWidget" };
  const on = { ...off, value: "on" };

  // Each Switch move takes the next answer. `show` is the parent or the app changing what the Switch shows.
  function renderScripted(onMove: (enabled: boolean, show: (enabled: boolean) => void) => boolean | Promise<boolean>) {
    const recorder = recordingCapture();
    const props = meta.galleryStates[1].props;
    let show: (enabled: boolean) => void = () => {};
    function Parent() {
      const [widgets, setWidgets] = useState(props.widgets);
      show = (enabled) => setWidgets((current) => current.map((widget) => ({ ...widget, enabled })));
      return <WidgetPicker {...props} widgets={widgets} onWidgetChange={(_id, enabled) => onMove(enabled, show)} />;
    }
    const user = userEvent.setup();
    render(<CaptureProvider sink={recorder.sink}><Parent /></CaptureProvider>);
    return {
      move: () => user.click(screen.getByRole("switch", { name: "Resume" })),
      show: (enabled: boolean) => act(() => show(enabled)),
      changes: () => recorder.events.filter(({ name }) => name === "setting_changed"),
    };
  }

  function deferredAnswers() {
    const answers: Array<(accepted: boolean) => void> = [];
    return {
      next: () => new Promise<boolean>((resolve) => answers.push(resolve)),
      answer: (index: number, accepted: boolean) => act(async () => answers[index](accepted)),
    };
  }

  it("does not let a move join a shown request: an accepted change never shown records nothing", async () => {
    let calls = 0;
    const picker = renderScripted((enabled, show) => {
      if (++calls > 1) return true;
      show(enabled);
      return new Promise<boolean>(() => {});
    });
    await picker.move();
    picker.show(true);
    await picker.move();
    expect(picker.changes()).toEqual([]);
  });

  it("does not let a move join a shown request: nothing is recorded before the value is shown", async () => {
    let calls = 0;
    const picker = renderScripted((enabled, show) => {
      if (++calls > 1) return true;
      show(enabled);
      return new Promise<boolean>(() => {});
    });
    await picker.move();
    picker.show(true);
    await picker.move();
    expect(picker.changes()).toEqual([]);
    picker.show(false);
    expect(picker.changes()).toEqual([off]);
  });

  it("records three quick moves shown at once and accepted in order", async () => {
    const saves = deferredAnswers();
    const picker = renderScripted((enabled, show) => { show(enabled); return saves.next(); });
    await picker.move();
    await picker.move();
    await picker.move();
    for (const index of [0, 1, 2]) await saves.answer(index, true);
    expect(picker.changes()).toEqual([off, on, off]);
  });

  it("does not record a change shown while its answer is pending and then refused", async () => {
    const saves = deferredAnswers();
    const picker = renderScripted((enabled, show) => { show(enabled); return saves.next(); });
    await picker.move();
    expect(picker.changes()).toEqual([]);
    await saves.answer(0, false);
    expect(picker.changes()).toEqual([]);
  });

  it("does not record an app change that follows a throwing parent", async () => {
    const errors: string[] = [];
    const onError = (event: ErrorEvent) => { errors.push(event.error.message); event.preventDefault(); };
    window.addEventListener("error", onError);
    const picker = renderScripted(() => { throw new Error("save failed"); });
    await picker.move();
    picker.show(false);
    window.removeEventListener("error", onError);
    expect(picker.changes()).toEqual([]);
    expect(errors).toEqual(["save failed"]);
  });

  it("records a grouped change that one move accepted and a later answer refused", async () => {
    const saves = deferredAnswers();
    const picker = renderScripted(saves.next);
    await picker.move();
    await picker.move();
    await saves.answer(0, true);
    await saves.answer(1, false);
    expect(picker.changes()).toEqual([]);
    picker.show(false);
    expect(picker.changes()).toEqual([off]);
  });

  it("passes the selected available widget id to onAdd", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<WidgetPicker {...meta.galleryStates[1].props} onAdd={onAdd} />);
    await user.click(screen.getByRole("button", { name: "Add Data table" }));
    expect(onAdd).toHaveBeenCalledWith("supplier_watch");
  });

  it("does not record a setting change when the parent accepts an added widget", async () => {
    const recorder = recordingCapture();
    const user = userEvent.setup();
    const initial = meta.galleryStates[1].props;

    function AcceptingParent() {
      const [widgets, setWidgets] = useState(initial.widgets);
      const [availableWidgets, setAvailableWidgets] = useState(initial.availableWidgets);
      return <WidgetPicker {...initial} widgets={widgets} availableWidgets={availableWidgets} onAdd={(widgetId) => {
        const added = availableWidgets.find((widget) => widget.widgetId === widgetId);
        if (!added) return;
        setWidgets((current) => [...current, { ...added, enabled: true }]);
        setAvailableWidgets((current) => current.filter((widget) => widget.widgetId !== widgetId));
      }} />;
    }

    render(<CaptureProvider sink={recorder.sink}><AcceptingParent /></CaptureProvider>);
    await user.click(screen.getByRole("button", { name: "Add Data table" }));
    expect(screen.getByRole("switch", { name: "Data table" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByRole("button", { name: "Add Data table" })).toBeNull();
    expect(recorder.events.filter(({ name }) => name === "setting_changed")).toEqual([]);
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
