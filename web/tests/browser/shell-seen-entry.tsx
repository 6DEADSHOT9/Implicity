import { createRoot } from "react-dom/client";
import { AppShell } from "../../src/registry/AppShell/AppShell";
import { ChatHeader } from "../../src/registry/ChatHeader/ChatHeader";
import { Composer } from "../../src/registry/Composer/Composer";
import { ConversationNavigation } from "../../src/registry/ConversationNavigation/ConversationNavigation";
import { Search } from "../../src/registry/Search/Search";
import { Settings } from "../../src/registry/Settings/Settings";
import { CaptureProvider, type CapturedEvent } from "../../src/registry";

declare global {
  interface Window {
    shellSeenEvents: CapturedEvent[];
    shellSeenAt: number[];
    shellMountedAt: number;
    mountShellSeen(): void;
  }
}

const entries = [
  <AppShell key="AppShell" panelOpen={false} />,
  <ConversationNavigation key="ConversationNavigation" items={[{ id: "chat", label: "Planning" }]} projects={[]} recent={[]} quota="Available" />,
  <Composer key="Composer" attachments={[]} shortcuts={[]} />,
  <ChatHeader key="ChatHeader" title="Planning" kind="coding" />,
  <Search key="Search" open results={[]} />,
  <Settings key="Settings" open tab="preferences" />,
];

window.mountShellSeen = () => {
  window.shellSeenEvents = [];
  window.shellSeenAt = [];
  window.shellMountedAt = performance.now();
  const host = document.createElement("div");
  host.style.cssText = "position: fixed; inset: 0; z-index: 40; overflow: auto; background: var(--background)";
  document.body.append(host);
  createRoot(host).render(<CaptureProvider sink={(event) => { window.shellSeenEvents.push(event); if (event.name === "component_seen") window.shellSeenAt.push(performance.now()); }}><div style={{ display: "grid", gridTemplateColumns: "repeat(3, 400px)", gridTemplateRows: "repeat(2, 450px)" }}>{entries.map((entry) => <div key={entry.key} style={{ position: "relative", height: 450, overflow: "hidden" }}>{entry}</div>)}</div></CaptureProvider>);
};
