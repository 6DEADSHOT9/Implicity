import { createRoot } from "react-dom/client";
import { Gallery } from "../../src/gallery";
import { createRegistry, registryVersion } from "../../src/registry";
import { entries } from "../../src/registry/entries";
import "../../src/tokens.css";

const names = new Set(["DataTable", "DataChart", "CodeBlock", "MediaPlayer", "ArtifactWorkspace", "Checklist", "List", "Metric", "Tabs", "Card", "ChangeNotice", "ProposalCard", "Nudge"]);
const requested = new Set(new URLSearchParams(location.search).getAll("preview"));
const contentEntries = entries.filter(({ id }) => names.has(id));
const selectedEntries = requested.size ? contentEntries.flatMap((entry) => {
  const galleryStates = entry.meta.galleryStates.filter(({ id }) => requested.has(`${entry.id} · ${id}`));
  if (!galleryStates.length) return [];
  const defaultStates = galleryStates.map(({ id }) => id);
  return [{ ...entry, meta: { ...entry.meta, galleryStates, defaultStates } }];
}) : contentEntries;
const registry = createRegistry(selectedEntries, registryVersion);

createRoot(document.getElementById("root")!).render(<Gallery registry={registry} />);
