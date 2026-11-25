import { describe, expect, it } from "vitest";
import { createRegistry } from "../../../registry";
import { ReviewPanelEntry } from "../../../../tests/fixtures/ReviewPanel/entry";

describe("colocated Skeleton fixture", () => {
  it("registers its declared gallery states", () => {
    const registered = createRegistry([ReviewPanelEntry], 1);
    expect(registered.getSkeleton("ReviewPanel")?.meta.galleryStates.map(({ id }) => id)).toEqual(["plain", "busy", "tall", "error"]);
  });
});
