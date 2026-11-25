import { createRoot } from "react-dom/client";
import { useState } from "react";
import { CaptureProvider, useSeen } from "../../src/registry";

function Probe({ tag }: { tag: "section" | "article" }) {
  const ref = useSeen({ component: "ReviewPanel", defaultState: "plain", slot: "main" });
  const Tag = tag;
  return <Tag id="seen-target" ref={ref}>observed</Tag>;
}

function App() {
  const [tag, setTag] = useState<"section" | "article">("section");
  const [mounted, setMounted] = useState(true);
  window.seenTest = {
    replaceTarget: () => setTag((current) => current === "section" ? "article" : "section"),
    toggleMount: () => setMounted((current) => !current),
  };
  return <CaptureProvider sink={(event) => window.seenEvents.push(event)}>
    <div id="opacity-parent"><div id="clip"><div id="target-holder">{mounted && <Probe tag={tag} />}</div></div></div>
  </CaptureProvider>;
}

window.seenEvents = [];
createRoot(document.getElementById("root")!).render(<App />);
