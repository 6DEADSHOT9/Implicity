import { createRoot } from "react-dom/client";
import { ChangeNotice } from "../../src/registry/ChangeNotice/ChangeNotice";
import { CaptureProvider, type CapturedEvent } from "../../src/registry/capture";

declare global {
  interface Window {
    noticeActions: string[];
    systemMessageEvents: CapturedEvent[];
    revealOpacity(): void;
  }
}

export function mountConcurrentNotices() {
  window.noticeActions = [];
  const root = document.createElement("div");
  document.body.append(root);
  createRoot(root).render(<CaptureProvider sink={() => undefined}>
    <ChangeNotice decision_id="dec_123e4567-e89b-42d3-a456-426614174000" title="First decision" reason="First reason" presentation="toast" onKeep={() => window.noticeActions.push("first:keep")} onUndo={() => window.noticeActions.push("first:undo")} />
    <ChangeNotice decision_id="dec_223e4567-e89b-42d3-a456-426614174000" title="Second decision" reason="Second reason" presentation="toast" onKeep={() => window.noticeActions.push("second:keep")} onUndo={() => window.noticeActions.push("second:undo")} />
  </CaptureProvider>);
}

export function mountVisibilityCases() {
  window.systemMessageEvents = [];
  const root = document.createElement("div");
  document.body.append(root);
  createRoot(root).render(<CaptureProvider sink={(event) => window.systemMessageEvents.push(event)}>
    <details id="details-case"><summary>Reveal inline notice</summary><ChangeNotice decision_id="dec_323e4567-e89b-42d3-a456-426614174000" title="Details notice" reason="Details reason" presentation="inline" /></details>
    <div id="opacity-case" style={{ opacity: 0, transition: "opacity 180ms linear" }}><ChangeNotice decision_id="dec_423e4567-e89b-42d3-a456-426614174000" title="Opacity notice" reason="Opacity reason" presentation="inline" /></div>
  </CaptureProvider>);
  window.revealOpacity = () => requestAnimationFrame(() => { document.querySelector<HTMLElement>("#opacity-case")!.style.opacity = "1"; });
}

export function mountOpacityToast() {
  window.systemMessageEvents = [];
  window.noticeActions = [];
  const root = document.createElement("div");
  document.body.append(root);
  createRoot(root).render(<CaptureProvider sink={(event) => window.systemMessageEvents.push(event)}>
    <ChangeNotice decision_id="dec_523e4567-e89b-42d3-a456-426614174000" title="Opacity toast" reason="Opacity reason" presentation="toast" onKeep={() => window.noticeActions.push("opacity:keep")} />
  </CaptureProvider>);
}

export function mountPartialInlineNotice() {
  window.systemMessageEvents = [];
  window.noticeActions = [];
  const root = document.createElement("div");
  root.style.cssText = "padding-top: 500px; padding-bottom: 1000px";
  document.body.append(root);
  createRoot(root).render(<CaptureProvider sink={(event) => window.systemMessageEvents.push(event)}>
    <ChangeNotice decision_id="dec_623e4567-e89b-42d3-a456-426614174000" title="Partial inline notice" reason="Actions should remain available after it has been shown." presentation="inline" onKeep={() => window.noticeActions.push("keep")} onUndo={() => window.noticeActions.push("undo")} />
  </CaptureProvider>);
}
