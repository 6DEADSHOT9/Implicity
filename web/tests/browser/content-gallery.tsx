import { createRoot } from "react-dom/client";
import { Gallery } from "../../src/gallery";
import { createRegistry, registryVersion } from "../../src/registry";
import { entries } from "../../src/registry/entries";
import "../../src/tokens.css";

const names = new Set(["DataTable", "DataChart", "CodeBlock", "MediaPlayer", "ArtifactWorkspace", "Checklist", "List", "Metric", "Tabs", "Card", "ChangeNotice", "ProposalCard", "Nudge"]);
const registry = createRegistry(entries.filter(({ id }) => names.has(id)), registryVersion);

createRoot(document.getElementById("root")!).render(<Gallery registry={registry} />);
