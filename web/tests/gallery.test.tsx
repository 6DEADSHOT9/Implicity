// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { createRegistry } from "../src/registry";
import { Gallery } from "../src/gallery";
import focused from "../../contracts/looks/focused.json" with { type: "json" };
import { ReviewPanelEntry } from "./fixtures/ReviewPanel/entry";
import { ReviewShellEntry } from "./fixtures/ReviewShell/entry";
import { vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function renderGallery(registry = createRegistry([ReviewPanelEntry], 1)) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<Gallery registry={registry} />));
  return { container, root };
}

describe("gallery", () => {
  it("renders every registry entry in each declared gallery state", async () => {
    const entries = [ReviewPanelEntry, ReviewShellEntry];
    const { container, root } = await renderGallery(createRegistry(entries, 1));
    for (const entry of entries) {
      for (const state of entry.meta.galleryStates) {
        expect(container.querySelector(`[data-skeleton='${entry.id}'][data-gallery-state='${state.id}']`)).not.toBeNull();
      }
    }
    expect(container.querySelector("[data-skeleton='ReviewPanel'][data-gallery-state='plain']")?.textContent).toContain("1one");
    expect(container.querySelector("[data-skeleton='ReviewPanel'][data-gallery-state='busy']")?.textContent).toContain("4twothree");
    await act(async () => root.unmount());
  });

  it("shows newly registered skeletons without gallery changes", async () => {
    const { container, root } = await renderGallery(createRegistry([ReviewPanelEntry, ReviewShellEntry], 2));
    expect(container.querySelector("[data-skeleton='ReviewPanel']")).not.toBeNull();
    expect(container.querySelector("[data-skeleton='ReviewShell']")).not.toBeNull();
    await act(async () => root.unmount());
  });

  it("contains a Skeleton render error to its state card", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const entry = { ...ReviewPanelEntry, meta: { ...ReviewPanelEntry.meta, galleryStates: ReviewPanelEntry.meta.galleryStates.map((state) => state.id === "busy" ? { ...state, props: { ...state.props, fail: true } } : state) } } as typeof ReviewPanelEntry;
    const { container, root } = await renderGallery(createRegistry([entry], 1));
    expect(container.querySelector("[role='alert']")?.textContent).toContain("ReviewPanel · busy");
    expect(container.querySelector("[data-gallery-state='plain']")).not.toBeNull();
    await act(async () => root.unmount());
    vi.restoreAllMocks();
  });

  it("applies look, mode, density, text size and screen size selections", async () => {
    const { container, root } = await renderGallery();
    const select = (label: string, value: string) => {
      const control = [...container.querySelectorAll("select")].find((item) => item.getAttribute("aria-label") === label)!;
      act(() => { control.value = value; control.dispatchEvent(new Event("change", { bubbles: true })); });
    };
    select("Look", "focused");
    expect(container.querySelector("[data-gallery-root]")?.getAttribute("data-look")).toBe("focused");
    expect((container.querySelector("[data-gallery-root]") as HTMLElement).style.getPropertyValue("--background")).toBe(focused.light.background);
    select("Mode", "dark");
    expect(container.querySelector("[data-gallery-root]")?.getAttribute("data-mode")).toBe("dark");
    expect((container.querySelector("[data-gallery-root]") as HTMLElement).style.getPropertyValue("--background")).toBe(focused.dark.background);
    select("Density", "spacious");
    expect(container.querySelector("[data-gallery-root]")?.getAttribute("data-density")).toBe("spacious");
    expect((container.querySelector("[data-gallery-root]") as HTMLElement).style.getPropertyValue("--space-1")).toBe("0.375rem");
    select("Text size", "5");
    expect(container.querySelector("[data-gallery-root]")?.getAttribute("data-text-size")).toBe("5");
    expect((container.querySelector("[data-gallery-root]") as HTMLElement).style.getPropertyValue("--text-base")).toBe("1.40625rem");
    select("Screen size", "tablet");
    expect(container.querySelector("[data-gallery-root]")?.getAttribute("data-device-class")).toBe("tablet");
    await act(async () => root.unmount());
  });
});
