import { Component, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { SkeletonEntry } from "./registry";

class PreviewBoundary extends Component<{ children: ReactNode; label: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p style={{ color: "var(--destructive)" }} role="alert">{this.props.label}: preview failed</p> : this.props.children; }
}

function PreviewExample({ entry, props, slots, label, viewportWidth }: { entry: SkeletonEntry; props: Record<string, unknown>; slots: Record<string, ReactNode>; label: string; viewportWidth: number }) {
  const [exampleProps, setExampleProps] = useState(props);
  useEffect(() => setExampleProps(props), [props]);
  const onAction = (action: string, value?: string | number | boolean) => {
    if (action === "representation" && (value === "table" || value === "chart")) setExampleProps((current) => ({ ...current, form: value }));
    if (action === "tab_select" && typeof value === "string") setExampleProps((current) => ({ ...current, selected: value }));
    if (action === "checklist_toggle" && typeof value === "number") setExampleProps((current) => ({ ...current, items: (current.items as Array<{ label: string; checked: boolean }>).map((item, index) => index === value ? { ...item, checked: !item.checked } : item) }));
  };
  return <PreviewBoundary label={label}><entry.Component props={exampleProps} slots={slots} onAction={onAction} /></PreviewBoundary>;
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
  let mode = "light";
  let viewportWidth = 1440;
  let previousHeight = -1;
  const previewRoot = document.getElementById("root")!;
  const reportHeight = () => {
    const height = previewRoot.getBoundingClientRect().height;
    if (height === previousHeight) return;
    previousHeight = height;
    window.parent.postMessage({ type: "preview-height", height }, location.origin);
  };
  const heightObserver = new ResizeObserver(reportHeight);
  heightObserver.observe(document.documentElement);
  heightObserver.observe(previewRoot);
  const render = () => {
    if (styles === undefined || texture === undefined) return;
    document.documentElement.style.cssText = styles;
    document.documentElement.dataset.texture = texture;
    document.documentElement.dataset.mode = mode;
    document.body.className = "gallery-preview-root";
    root.render(entry && state
      ? <PreviewExample entry={entry} props={state.props} slots={state.slots ?? {}} label={`${entry.id} · ${state.id}`} viewportWidth={viewportWidth} />
      : <p role="alert">Preview unavailable</p>);
    requestAnimationFrame(reportHeight);
  };
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.origin !== location.origin || event.source !== window.parent || !event.data || typeof event.data !== "object" || !("styles" in event.data) || typeof event.data.styles !== "string" || !("texture" in event.data) || typeof event.data.texture !== "string") return;
    styles = event.data.styles;
    texture = event.data.texture;
    if ("mode" in event.data && (event.data.mode === "light" || event.data.mode === "dark")) mode = event.data.mode;
    if ("viewportWidth" in event.data && (event.data.viewportWidth === 800 || event.data.viewportWidth === 1440)) viewportWidth = event.data.viewportWidth;
    render();
  });
  void loadEntry(entryId).then((loaded) => {
    entry = loaded;
    state = entry?.meta.galleryStates.find(({ id }) => id === stateId);
    render();
  }).catch(() => render());
}
