import { createRoot } from "react-dom/client";
import { Gallery } from "../../src/gallery";
import { createRegistry, registryVersion } from "../../src/registry";
import { entries } from "../../src/registry/entries";
import "../../src/tokens.css";

const registry = createRegistry(entries.filter(({ id }) => id === "WidgetPicker"), registryVersion);

createRoot(document.getElementById("root")!).render(<Gallery registry={registry} />);
