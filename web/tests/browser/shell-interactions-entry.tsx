import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Search } from "../../src/registry/Search/Search";
import { Settings } from "../../src/registry/Settings/Settings";
import { CaptureProvider, type CapturedEvent } from "../../src/registry";

declare global {
  interface Window {
    shellInteractionEvents: CapturedEvent[];
    shellSearchQueries: string[];
    mountShellInteractions(): void;
  }
}

const allResults = Array.from({ length: 30 }, (_, index) => ({ id: `conversation-${index}`, label: `Planning conversation ${index}` }));

function ShellInteractions() {
  const [searchOpen, setSearchOpen] = useState(true);
  const [results, setResults] = useState(allResults);
  const [settingsOpen, setSettingsOpen] = useState(false);
  return <>
    <Search open={searchOpen} results={results} onOpenChange={setSearchOpen} onSearch={(query) => {
      window.shellSearchQueries.push(query);
      setResults(query ? [] : allResults);
    }} />
    <button type="button" onClick={() => setSettingsOpen(true)}>Open app settings</button>
    <Settings open={settingsOpen} tab="preferences" onClose={() => setSettingsOpen(false)} />
  </>;
}

window.mountShellInteractions = () => {
  window.shellInteractionEvents = [];
  window.shellSearchQueries = [];
  const host = document.createElement("div");
  host.style.cssText = "position: fixed; inset: 0; z-index: 1000; overflow: auto; background: var(--background)";
  document.body.append(host);
  createRoot(host).render(<CaptureProvider sink={(event) => window.shellInteractionEvents.push(event)}><ShellInteractions /></CaptureProvider>);
};
