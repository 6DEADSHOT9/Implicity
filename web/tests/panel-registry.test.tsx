import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Gallery } from "../src/gallery";
import { registry } from "../src/registry";

describe("panel Skeletons in the registry gallery", () => {
  it("registers and lists each declared state", () => {
    const html = renderToStaticMarkup(<Gallery />);
    for (const id of ["DockedPanel", "SourcesPanel", "ProjectPanel"]) {
      const entry = registry.getSkeleton(id);
      expect(entry).toBeDefined();
      expect(html).toContain(`data-skeleton="${id}"`);
      for (const state of entry!.meta.galleryStates) expect(html).toContain(`data-gallery-state="${state.id}"`);
    }
  });
});
