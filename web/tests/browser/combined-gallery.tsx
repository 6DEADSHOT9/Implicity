import { createRoot } from "react-dom/client";
import { Gallery } from "../../src/gallery";
import { createRegistry, registryVersion } from "../../src/registry";
import { entries } from "../../src/registry/entries";
import "../../src/tokens.css";

// Everything but the shells, which have their own gallery: the full page loads too slowly for the default wait under parallel tests.
const registry = createRegistry(entries.filter(({ meta }) => meta.role !== "shell"), registryVersion);

createRoot(document.getElementById("root")!).render(<Gallery registry={registry} />);
