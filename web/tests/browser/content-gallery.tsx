import { createRoot } from "react-dom/client";
import { Gallery } from "../../src/gallery";
import { galleryRegistry } from "./gallery-metadata";

const names = new Set(["DataTable", "DataChart", "CodeBlock", "MediaPlayer", "ArtifactWorkspace", "Checklist", "List", "Metric", "Tabs", "Card", "ChangeNotice", "ProposalCard", "Nudge"]);
const registry = galleryRegistry(names, location.search);
const initialDeviceClass = new URLSearchParams(location.search).get("device") === "tablet" ? "tablet" : "desktop";

createRoot(document.getElementById("root")!).render(<Gallery registry={registry} initialDeviceClass={initialDeviceClass} />);
