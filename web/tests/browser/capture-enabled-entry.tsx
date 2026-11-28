import { createRoot } from "react-dom/client";
import { BrowserCaptureProvider } from "../../src/registry/capture";
import { registry } from "../../src/registry";
import { ShortcutChips } from "../../src/registry/ShortcutChips/ShortcutChips";

// The control for the gallery capture test: the same server, key and host, with capture enabled.
createRoot(document.getElementById("root")!).render(<BrowserCaptureProvider registry={registry} enabled>
  <ShortcutChips commands={[{ id: "search", label: "Search" }]} />
</BrowserCaptureProvider>);
