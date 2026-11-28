import { createRoot } from "react-dom/client";
import { Gallery } from "../../src/gallery";
import { galleryRegistry } from "./gallery-metadata";

const names = new Set(["DockedPanel", "SourcesPanel", "ProjectPanel"]);
const registry = galleryRegistry(names, location.search);

createRoot(document.getElementById("root")!).render(<Gallery registry={registry} />);
