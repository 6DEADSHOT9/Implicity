import { mountPreview } from "../../src/preview-runtime";
import "../../src/tokens.css";
import "../../src/gallery.css";

mountPreview(async (id) => {
  if (id === "ReviewPanel") return (await import("../fixtures/ReviewPanel/entry")).ReviewPanelEntry;
  if (id === "ReviewShell") return (await import("../fixtures/ReviewShell/entry")).ReviewShellEntry;
  return undefined;
});
