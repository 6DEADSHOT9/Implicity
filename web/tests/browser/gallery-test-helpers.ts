import type { Page } from "@playwright/test";

export function builtPreviewUrl(path: string) {
  const port = process.env.GALLERY_PREVIEW_PORT ?? "4174";
  return `http://127.0.0.1:${port}${path}`;
}

export async function selectGallerySettings(page: Page, settings: Record<string, string>, timeout?: number) {
  await page.locator("[data-gallery-root]").evaluate((gallery, values) => {
    for (const [label, value] of Object.entries(values)) {
      const select = gallery.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
      if (!select || !Array.from(select.options).some((option) => option.value === value)) {
        throw new Error(`Gallery setting ${label} has no option ${value}`);
      }
      if (select.value === value) continue;
      select.value = value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, settings, { timeout });
}
