import { Component, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { SkeletonEntry } from "./registry";
import { WidgetPicker } from "./registry/WidgetPicker/WidgetPicker";
import type { propsSchema } from "./registry/WidgetPicker/schema";
import type { z } from "zod";
import { ChangeNoticeToastHost } from "./components/change-notice-toast-host";

class PreviewBoundary extends Component<{ children: ReactNode; label: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p style={{ color: "var(--destructive)" }} role="alert">{this.props.label}: preview failed</p> : this.props.children; }
}

function WidgetPickerExample({ props }: { props: z.infer<typeof propsSchema> }) {
  const [open, setOpen] = useState(false);
  const [widgets, setWidgets] = useState(props.widgets);
  const [availableWidgets, setAvailableWidgets] = useState(props.availableWidgets);
  useEffect(() => {
    if (open) document.body.dataset.previewPicker = "open";
    else delete document.body.dataset.previewPicker;
    return () => { delete document.body.dataset.previewPicker; };
  }, [open]);
  return <WidgetPicker
    open={open}
    title={props.title}
    widgets={widgets}
    availableWidgets={availableWidgets}
    onOpenChange={setOpen}
    onWidgetChange={(widgetId, enabled) => setWidgets((current) => current.map((widget) => widget.widgetId === widgetId ? { ...widget, enabled } : widget))}
    onAdd={(widgetId) => {
      const added = availableWidgets.find((widget) => widget.widgetId === widgetId);
      if (!added) return;
      setWidgets((current) => [...current, { ...added, enabled: true }]);
      setAvailableWidgets((current) => current.filter((widget) => widget.widgetId !== widgetId));
    }}
  />;
}

function PreviewExample({ entry, props, slots, label }: { entry: SkeletonEntry; props: Record<string, unknown>; slots: Record<string, ReactNode>; label: string }) {
  const [exampleProps, setExampleProps] = useState(props);
  useEffect(() => setExampleProps(props), [props]);
  const onAction = (action?: string, value?: string | number | boolean) => {
    if (action === "representation" && (value === "table" || value === "chart")) setExampleProps((current) => ({ ...current, form: value }));
    if (action === "tab_select" && typeof value === "string") setExampleProps((current) => ({ ...current, selected: value }));
    if (action === "checklist_toggle" && typeof value === "number") setExampleProps((current) => ({ ...current, items: (current.items as Array<{ label: string; checked: boolean }>).map((item, index) => index === value ? { ...item, checked: !item.checked } : item) }));
  };
  return <PreviewBoundary label={label}>{entry.id === "WidgetPicker"
    ? <WidgetPickerExample props={props as z.infer<typeof propsSchema>} />
    : <entry.Component props={exampleProps} slots={slots} onAction={onAction} />}</PreviewBoundary>;
}

function PreviewMounted({ children, onMounted, version }: { children: ReactNode; onMounted: (version: number) => void; version: number }) {
  useEffect(() => onMounted(version), [onMounted, version]);
  return children;
}

export function mountPreview(loadEntry: (id: string) => Promise<SkeletonEntry | undefined>) {
  const params = new URLSearchParams(location.search);
  const entryId = params.get("entry") ?? "";
  const stateId = params.get("state");
  const root = createRoot(document.getElementById("root")!);
  let entry: SkeletonEntry | undefined;
  let state: SkeletonEntry["meta"]["galleryStates"][number] | undefined;
  let styles: string | undefined;
  let texture: string | undefined;
  let config: { look: string; mode: string; density: string; textSize: string; deviceClass: string } | undefined;
  let previousHeight = -1;
  let mounted = false;
  let fontsLoaded = false;
  let entrySettled = false;
  let renderVersion = 0;
  const previewRoot = document.getElementById("root")!;
  const reportHeight = () => {
    if (!mounted || !fontsLoaded) return;
    const height = document.body.dataset.previewPicker
      ? Math.max(previewRoot.getBoundingClientRect().height, document.body.scrollHeight)
      : previewRoot.getBoundingClientRect().height;
    if (height === previousHeight) return;
    previousHeight = height;
    window.parent.postMessage({ type: "preview-height", height }, location.origin);
  };
  const onMounted = (version: number) => {
    mounted = true;
    getComputedStyle(previewRoot).fontFamily;
    previewRoot.getBoundingClientRect();
    void document.fonts.ready.then(() => {
      if (version !== renderVersion) return;
      fontsLoaded = true;
      reportHeight();
    });
  };
  const heightObserver = new ResizeObserver(reportHeight);
  heightObserver.observe(document.documentElement);
  heightObserver.observe(document.body);
  heightObserver.observe(previewRoot);
  const render = () => {
    if (styles === undefined || texture === undefined || config === undefined || !entrySettled) return;
    const version = ++renderVersion;
    mounted = false;
    fontsLoaded = false;
    document.documentElement.style.cssText = styles;
    Object.assign(document.documentElement.dataset, {
      texture, look: config.look, mode: config.mode, density: config.density,
      textSize: config.textSize, deviceClass: config.deviceClass,
    });
    document.body.className = "gallery-preview-root";
    document.body.dataset.previewState = state?.id;
    root.render(<PreviewMounted onMounted={onMounted} version={version}>{entry && state
      ? <PreviewExample entry={entry} props={state.props} slots={state.slots ?? {}} label={`${entry.id} · ${state.id}`} />
      : <p role="alert">Preview unavailable</p>}<ChangeNoticeToastHost mode={config.mode === "dark" ? "dark" : "light"} /></PreviewMounted>);
  };
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.origin !== location.origin || event.source !== window.parent || !event.data || typeof event.data !== "object" || !("styles" in event.data) || typeof event.data.styles !== "string" || !("texture" in event.data) || typeof event.data.texture !== "string" || !("look" in event.data) || typeof event.data.look !== "string" || !("mode" in event.data) || typeof event.data.mode !== "string" || !("density" in event.data) || typeof event.data.density !== "string" || !("textSize" in event.data) || typeof event.data.textSize !== "string" || !("deviceClass" in event.data) || typeof event.data.deviceClass !== "string") return;
    config = { look: event.data.look, mode: event.data.mode, density: event.data.density, textSize: event.data.textSize, deviceClass: event.data.deviceClass };
    styles = event.data.styles;
    texture = event.data.texture;
    render();
  });
  void loadEntry(entryId).then((loaded) => {
    entry = loaded;
    state = entry?.meta.galleryStates.find(({ id }) => id === stateId);
    entrySettled = true;
    render();
  }).catch(() => {
    entrySettled = true;
    render();
  });
}
