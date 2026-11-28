import { createRoot } from "react-dom/client";
import { CaptureProvider } from "../../src/registry/capture";
import { useSeen } from "../../src/registry/use-seen";

window.seenEvents = [];
window.offscreenRootVisible = false;

function Probe() {
  const ref = useSeen({ component: "OffscreenScrollProbe", defaultState: "plain" });
  return <div id="seen-target" ref={ref}>Offscreen scroll area probe</div>;
}

createRoot(document.getElementById("root")!).render(
  <CaptureProvider sink={(event) => window.seenEvents.push(event)}><Probe /></CaptureProvider>,
);

new IntersectionObserver(([entry]) => { window.offscreenRootVisible = entry.isIntersecting; }).observe(document.getElementById("scroll-root")!);
