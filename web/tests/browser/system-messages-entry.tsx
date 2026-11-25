import { createRoot } from "react-dom/client";
import { ChangeNotice, ChangeNoticeToastHost } from "../../src/registry/ChangeNotice/ChangeNotice";

declare global {
  interface Window { noticeActions: string[] }
}

export function mountConcurrentNotices() {
  window.noticeActions = [];
  const root = document.createElement("div");
  document.body.append(root);
  createRoot(root).render(<><ChangeNoticeToastHost />
    <ChangeNotice decision_id="dec_123e4567-e89b-42d3-a456-426614174000" title="First decision" reason="First reason" presentation="toast" onKeep={() => window.noticeActions.push("first:keep")} onUndo={() => window.noticeActions.push("first:undo")} />
    <ChangeNotice decision_id="dec_223e4567-e89b-42d3-a456-426614174000" title="Second decision" reason="Second reason" presentation="toast" onKeep={() => window.noticeActions.push("second:keep")} onUndo={() => window.noticeActions.push("second:undo")} />
  </>);
}
