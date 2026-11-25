import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { SkeletonEntry } from "./registry";

class PreviewBoundary extends Component<{ children: ReactNode; label: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p style={{ color: "var(--destructive)" }} role="alert">{this.props.label}: preview failed</p> : this.props.children; }
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
  let previousHeight = -1;
  const reportHeight = () => {
    const height = document.documentElement.scrollHeight;
    if (height === previousHeight) return;
    previousHeight = height;
    window.parent.postMessage({ type: "preview-height", height }, location.origin);
  };
  const heightObserver = new ResizeObserver(reportHeight);
  heightObserver.observe(document.documentElement);
  heightObserver.observe(document.getElementById("root")!);
  const render = () => {
    if (styles === undefined || texture === undefined) return;
    document.documentElement.style.cssText = styles;
    document.documentElement.dataset.texture = texture;
    document.body.className = "gallery-preview-root";
    root.render(entry && state
      ? <PreviewBoundary label={`${entry.id} · ${state.id}`}><entry.Component props={state.props} slots={state.slots ?? {}} /></PreviewBoundary>
      : <p role="alert">Preview unavailable</p>);
    requestAnimationFrame(reportHeight);
  };
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.origin !== location.origin || event.source !== window.parent || !event.data || typeof event.data !== "object" || !("styles" in event.data) || typeof event.data.styles !== "string" || !("texture" in event.data) || typeof event.data.texture !== "string") return;
    styles = event.data.styles;
    texture = event.data.texture;
    render();
  });
  void loadEntry(entryId).then((loaded) => {
    entry = loaded;
    state = entry?.meta.galleryStates.find(({ id }) => id === stateId);
    render();
  }).catch(() => render());
}
