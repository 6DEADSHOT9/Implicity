import { createRoot } from "react-dom/client";
import { Gallery } from "../../src/gallery";
import { createRegistry, registryVersion } from "../../src/registry";
import { entries } from "../../src/registry/entries";
import { selectGalleryEntries } from "./gallery-selection";
import "../../src/tokens.css";

const names = new Set(["MessageBody", "Details", "RunActivity", "MessageActions", "AttachmentTray", "Citation", "ContextChip", "ShortcutChips", "ApprovalRequest"]);
const conversationEntries = entries.filter(({ id }) => names.has(id));
const registry = createRegistry(selectGalleryEntries(conversationEntries, location.search), registryVersion);

const initialDeviceClass = new URLSearchParams(location.search).get("device") === "tablet" ? "tablet" : "desktop";

createRoot(document.getElementById("root")!).render(<Gallery registry={registry} initialDeviceClass={initialDeviceClass} />);
