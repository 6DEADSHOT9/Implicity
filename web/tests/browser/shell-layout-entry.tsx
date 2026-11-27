import { createRoot } from "react-dom/client";
import { useState } from "react";
import { AppShell } from "../../src/registry/AppShell/AppShell";
import { CaptureProvider } from "../../src/registry";

declare global {
  interface Window {
    mountShellLayout(): void;
  }
}

function ShellLayout() {
  const [panelOpen, setPanelOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setPanelOpen(true)}>Open panel</button>
    <div data-testid="shell-host" style={{ width: 1201 }}>
      <AppShell panelOpen={panelOpen} slots={{ main: [<textarea aria-label="Draft" key="draft" />], panel: [<p key="panel">Panel content</p>] }} />
    </div>
  </>;
}

window.mountShellLayout = () => {
  const host = document.createElement("div");
  host.style.cssText = "position: fixed; inset: 0; z-index: 40; overflow: auto; background: var(--background)";
  document.body.append(host);
  createRoot(host).render(<CaptureProvider sink={() => {}}><ShellLayout /></CaptureProvider>);
};
