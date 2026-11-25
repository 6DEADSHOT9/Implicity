import { createRoot } from "react-dom/client";
import { ChangeNotice } from "../../src/registry/ChangeNotice/ChangeNotice";
import { ChangeNoticeToastHost } from "../../src/components/change-notice-toast-host";
import { CaptureProvider, type CapturedEvent } from "../../src/registry";

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
