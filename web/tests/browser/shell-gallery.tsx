import { createRoot } from "react-dom/client";
import { Gallery } from "../../src/gallery";
import { createRegistry, registryVersion } from "../../src/registry";
import { entries } from "../../src/registry/entries";
import { selectGalleryEntries } from "./gallery-selection";
import "../../src/tokens.css";

const names = new Set(["AppShell", "ConversationNavigation", "Composer", "ChatHeader", "Search", "Settings"]);
// A cold preview fetches dozens of dev-server modules, so each test loads only the shells it looks at: ?only=Search, or ?only= for none.
const only = new URLSearchParams(location.search).get("only")?.split(",");
const shellEntries = entries.filter(({ id }) => names.has(id) && (only?.includes(id) ?? true));
const registry = createRegistry(selectGalleryEntries(shellEntries, location.search), registryVersion);

createRoot(document.getElementById("root")!).render(<Gallery registry={registry} />);
