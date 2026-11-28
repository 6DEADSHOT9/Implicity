import { createRoot } from "react-dom/client";
import { Gallery } from "../../src/gallery";
import { mountConcurrentNotices, mountOpacityToast, mountPartialInlineNotice } from "./system-messages-entry";

const cases = {
  concurrent: mountConcurrentNotices,
  opacity: mountOpacityToast,
  partial: mountPartialInlineNotice,
};

declare global {
  interface Window {
    mountSystemMessageCase(name: keyof typeof cases): void;
  }
}

window.mountSystemMessageCase = (name) => cases[name]();
createRoot(document.getElementById("root")!).render(<Gallery registry={{ entries: new Map() }} />);
