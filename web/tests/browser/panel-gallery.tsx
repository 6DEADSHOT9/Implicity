import { createRoot } from "react-dom/client";
import { Gallery } from "../../src/gallery";
import { createRegistry, registryVersion } from "../../src/registry";
import { entries } from "../../src/registry/entries";
import { selectGalleryEntries } from "./gallery-selection";
import "../../src/tokens.css";

const names = new Set(["DockedPanel", "SourcesPanel", "ProjectPanel"]);
const panelEntries = entries.filter(({ id }) => names.has(id));
const registry = createRegistry(selectGalleryEntries(panelEntries, location.search), registryVersion);

createRoot(document.getElementById("root")!).render(<Gallery registry={registry} />);
