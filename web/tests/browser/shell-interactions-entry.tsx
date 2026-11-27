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
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState(allResults);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"preferences" | "locks" | "notices" | "history" | "quota">("preferences");
  return <>
    <div style={{ position: "absolute", top: 1000, width: "100%" }}><Search open={searchOpen} results={results} onOpenChange={setSearchOpen} onSearch={(query) => {
      window.shellSearchQueries.push(query);
      setResults(query ? [{ id: "filtered", label: "Filtered result" }] : allResults);
    }} /></div>
    <button type="button" onClick={() => setSearchOpen(true)}>Open app search</button>
    <button type="button" onClick={() => setSettingsOpen(true)}>Open app settings</button>
    <Settings open={settingsOpen} tab={settingsTab} onTabChange={setSettingsTab} onClose={() => setSettingsOpen(false)} slots={{ history: Array.from({ length: 30 }, (_, index) => <p key={index}>History record {index + 1}</p>) }} />
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
