import { Component, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { SkeletonEntry } from "./registry";

class PreviewBoundary extends Component<{ children: ReactNode; label: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p style={{ color: "var(--destructive)" }} role="alert">{this.props.label}: preview failed</p> : this.props.children; }
}

function PreviewMounted({ children, onMounted, version }: { children: ReactNode; onMounted: (version: number) => void; version: number }) {
  useEffect(() => onMounted(version), [onMounted, version]);
  return children;
}

function InteractivePreview({ entry, state }: { entry: SkeletonEntry; state: SkeletonEntry["meta"]["galleryStates"][number] }) {
  const [props, setProps] = useState<Record<string, unknown>>(() => ({ ...state.props }));
  const update = (key: string) => (value: unknown) => setProps((current) => ({ ...current, [key]: value }));
  const slots = state.slots ?? {};
  return <entry.Component props={props} slots={slots} interactions={{
    ...(Object.hasOwn(props, "activeTab") ? { onTabChange: update("activeTab") } : {}),
    ...(Object.hasOwn(props, "open") ? { onOpenChange: update("open") } : {}),
    ...(Object.hasOwn(props, "docked") ? { onDockChange: update("docked") } : {}),
  }} />;
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
  let heightReportPending = false;
  const previewRoot = document.getElementById("root")!;
  const readHeight = () => {
    const sheetBody = document.querySelector<HTMLElement>("[data-panel-sheet-body]");
    if (!sheetBody) return previewRoot.getBoundingClientRect().height;
    const body = sheetBody.getBoundingClientRect();
    const content = sheetBody.lastElementChild?.getBoundingClientRect();
    return content ? content.bottom - body.top + Number.parseFloat(getComputedStyle(sheetBody).paddingBottom) : body.height;
  };
  const reportHeight = () => {
    if (!mounted || !fontsLoaded || heightReportPending) return;
    if (!document.querySelector("[data-panel-sheet-body]")) {
      const height = readHeight();
      if (height === previousHeight) return;
      previousHeight = height;
      window.parent.postMessage({ type: "preview-height", height }, location.origin);
      return;
    }
    heightReportPending = true;
    const firstHeight = readHeight();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      heightReportPending = false;
      if (!mounted || !fontsLoaded) return;
      const height = readHeight();
      if (height !== firstHeight) {
        reportHeight();
        return;
      }
      if (height === previousHeight) return;
      previousHeight = height;
      window.parent.postMessage({ type: "preview-height", height }, location.origin);
    }));
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
  heightObserver.observe(previewRoot);
  const portalObserver = new MutationObserver(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (dialog) heightObserver.observe(dialog);
    const sheetBody = document.querySelector<HTMLElement>("[data-panel-sheet-body]");
    if (sheetBody) heightObserver.observe(sheetBody);
    reportHeight();
  });
  portalObserver.observe(document.body, { childList: true, subtree: true });
  const render = () => {
    if (styles === undefined || texture === undefined || config === undefined || !entrySettled) return;
    const version = ++renderVersion;
    mounted = false;
    fontsLoaded = false;
    previousHeight = -1;
    document.documentElement.style.cssText = styles;
    Object.assign(document.documentElement.dataset, {
      texture, look: config.look, mode: config.mode, density: config.density,
      textSize: config.textSize, deviceClass: config.deviceClass,
    });
    document.body.className = "gallery-preview-root";
    root.render(<PreviewMounted onMounted={onMounted} version={version}>{entry && state
      ? <PreviewBoundary label={`${entry.id} · ${state.id}`}><InteractivePreview entry={entry} state={state} /></PreviewBoundary>
      : <p role="alert">Preview unavailable</p>}</PreviewMounted>);
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
