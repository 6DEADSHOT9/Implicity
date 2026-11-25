import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { SkeletonEntry } from "./registry";

class PreviewBoundary extends Component<{ children: ReactNode; label: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p style={{ color: "var(--destructive)" }} role="alert">{this.props.label}: preview failed</p> : this.props.children; }
}

export function mountPreview(registry: { getSkeleton: (id: string) => SkeletonEntry | undefined }) {
  const params = new URLSearchParams(location.search);
  const entry = registry.getSkeleton(params.get("entry") ?? "");
  const state = entry?.meta.galleryStates.find(({ id }) => id === params.get("state"));
  const root = createRoot(document.getElementById("root")!);
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.origin !== location.origin || !event.data || typeof event.data !== "object" || !("styles" in event.data) || typeof event.data.styles !== "string" || !("texture" in event.data) || typeof event.data.texture !== "string") return;
    document.documentElement.style.cssText = event.data.styles;
    document.documentElement.dataset.texture = event.data.texture;
    document.body.className = "gallery-preview-root";
    root.render(entry && state
      ? <PreviewBoundary label={`${entry.id} · ${state.id}`}><entry.Component props={state.props} slots={state.slots ?? {}} /></PreviewBoundary>
      : <p role="alert">Preview unavailable</p>);
  });
}
