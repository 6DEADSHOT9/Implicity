import { createRoot } from "react-dom/client";
import { CaptureProvider } from "../../src/registry/capture";
import { useSeen } from "../../src/registry/use-seen";

window.seenEvents = [];

function TallNarrowProbe() {
  const ref = useSeen({ component: "TallNarrowProbe", defaultState: "plain" });
  return <div ref={ref} style={{ width: 40, height: 900 }}>Tall narrow visibility probe</div>;
}

createRoot(document.getElementById("root")!).render(
  <CaptureProvider sink={(event) => window.seenEvents.push(event)}><TallNarrowProbe /></CaptureProvider>,
);
