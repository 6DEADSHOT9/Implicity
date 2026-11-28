import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserCaptureProvider } from "../../src/registry/capture";
import { registry } from "../../src/registry";
import { MessageActions } from "../../src/registry/MessageActions/MessageActions";
import { ShortcutChips } from "../../src/registry/ShortcutChips/ShortcutChips";

/** A parent that accepts the form change, so MessageActions displays it and records the switch. */
function ControlledActions() {
  const [form, setForm] = useState<"prose" | "list" | "table">("prose");
  return <MessageActions answer_form={form} version_index={0} version_count={1} onAnswerFormChange={setForm} />;
}

// An enabled provider with the real registry, on whichever server's key and host: used by
// gallery-capture.spec.ts and by live delivery checks.
createRoot(document.getElementById("root")!).render(<BrowserCaptureProvider registry={registry} enabled>
  <ShortcutChips commands={[{ id: "search", label: "Search" }]} />
  <ControlledActions />
</BrowserCaptureProvider>);
