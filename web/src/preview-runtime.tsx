import { Component, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { SkeletonEntry } from "./registry";

class PreviewBoundary extends Component<{ children: ReactNode; label: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p style={{ color: "var(--destructive)" }} role="alert">{this.props.label}: preview failed</p> : this.props.children; }
}

function InteractivePreview({ entry, state }: { entry: SkeletonEntry; state: SkeletonEntry["meta"]["galleryStates"][number] }) {
  const [props, setProps] = useState<Record<string, unknown>>(() => ({ ...state.props }));
  const update = (key: string) => (value: unknown) => setProps((current) => ({ ...current, [key]: value }));
  const slots = entry.id === "ProjectPanel"
    ? entry.meta.galleryStates.find(({ props: example }) => example.activeTab === props.activeTab)?.slots ?? state.slots
    : state.slots;
  return <entry.Component props={props} interactions={{
    ...(Object.hasOwn(props, "activeTab") ? { onTabChange: update("activeTab") } : {}),
    ...(Object.hasOwn(props, "open") ? { onOpenChange: update("open") } : {}),
    ...(Object.hasOwn(props, "docked") ? { onDockChange: update("docked") } : {}),
  }} slots={slots ?? {}} />;
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
  let mode: string | undefined;
  let previousHeight = -1;
  const previewRoot = document.getElementById("root")!;
  const reportHeight = () => {
    const height = Math.max(previewRoot.getBoundingClientRect().height, document.querySelector<HTMLElement>('[role="dialog"]')?.scrollHeight ?? 0);
    if (height === previousHeight) return;
    previousHeight = height;
    window.parent.postMessage({ type: "preview-height", height }, location.origin);
  };
  const heightObserver = new ResizeObserver(reportHeight);
  heightObserver.observe(document.documentElement);
  heightObserver.observe(previewRoot);
  new MutationObserver(() => requestAnimationFrame(reportHeight)).observe(document.body, { childList: true, subtree: true });
  const render = () => {
    if (styles === undefined || texture === undefined || mode === undefined) return;
    document.documentElement.style.cssText = styles;
    document.documentElement.dataset.texture = texture;
    document.documentElement.dataset.mode = mode;
    document.body.className = "gallery-preview-root";
    root.render(entry && state
      ? <PreviewBoundary label={`${entry.id} · ${state.id}`}><InteractivePreview entry={entry} state={state} /></PreviewBoundary>
      : <p role="alert">Preview unavailable</p>);
    requestAnimationFrame(reportHeight);
  };
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.origin !== location.origin || event.source !== window.parent || !event.data || typeof event.data !== "object" || !("styles" in event.data) || typeof event.data.styles !== "string" || !("texture" in event.data) || typeof event.data.texture !== "string" || !("mode" in event.data) || !["light", "dark"].includes(String(event.data.mode))) return;
    styles = event.data.styles;
    texture = event.data.texture;
    mode = String(event.data.mode);
    render();
  });
  void loadEntry(entryId).then((loaded) => {
    entry = loaded;
    state = entry?.meta.galleryStates.find(({ id }) => id === stateId);
    render();
  }).catch(() => render());
}
