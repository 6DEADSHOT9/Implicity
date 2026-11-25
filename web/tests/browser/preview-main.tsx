import { createRegistry } from "../../src/registry";
import { mountPreview } from "../../src/preview-runtime";
import { ReviewPanelEntry } from "../fixtures/ReviewPanel/entry";
import { ReviewShellEntry } from "../fixtures/ReviewShell/entry";
import "../../src/tokens.css";
import "../../src/gallery.css";

mountPreview(createRegistry([ReviewPanelEntry, ReviewShellEntry], 1));
