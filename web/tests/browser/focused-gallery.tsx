import { createRoot } from "react-dom/client";
import { Gallery } from "../../src/gallery";
import { createRegistry, registryVersion } from "../../src/registry";
import { entries } from "../../src/registry/entries";
import { selectGalleryEntries } from "./gallery-selection";
import "../../src/tokens.css";

const params = new URLSearchParams(location.search);
const names = new Set(params.get("ids")?.split(","));
const selected = entries.filter(({ id }) => names.has(id));
const registry = createRegistry(selectGalleryEntries(selected, location.search), registryVersion);
const initialDeviceClass = params.get("device") === "tablet" ? "tablet" : "desktop";

createRoot(document.getElementById("root")!).render(<Gallery registry={registry} initialDeviceClass={initialDeviceClass} />);
