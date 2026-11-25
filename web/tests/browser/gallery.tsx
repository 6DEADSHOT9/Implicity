import { createRoot } from "react-dom/client";
import { Gallery } from "../../src/gallery";
import { createRegistry } from "../../src/registry";
import { ReviewPanelEntry } from "../fixtures/ReviewPanel/entry";
import { ReviewShellEntry } from "../fixtures/ReviewShell/entry";
import "../../src/tokens.css";

createRoot(document.getElementById("root")!).render(<Gallery registry={createRegistry([ReviewPanelEntry, ReviewShellEntry], 1)} />);
