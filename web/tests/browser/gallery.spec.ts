import { expect, test } from "@playwright/test";
import { tokenNames } from "../../src/registry/token-values.mjs";

test("screen size changes actual Skeleton preview width and all allowed tokens are set", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  const preview = page.locator("[data-skeleton='ReviewPanel'] .gallery-preview section").first();
  const desktop = await preview.boundingBox();
  expect(desktop).not.toBeNull();
  await page.getByLabel("Screen size").selectOption("tablet");
  const tablet = await preview.boundingBox();
  expect(tablet).not.toBeNull();
  expect(desktop!.width).toBeGreaterThan(tablet!.width);

  const customProperties = [...tokenNames].filter((name) => name.startsWith("--"));
  const missing = await page.locator("[data-gallery-root]").evaluate((element, names) => {
    const style = getComputedStyle(element);
    return names.filter((name) => !style.getPropertyValue(name).trim());
  }, customProperties);
  expect(missing).toEqual([]);
});

test("Notebook applies its bundled body font, paper texture, and both mode palettes without changing Skeleton headings", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  await page.getByLabel("Look").selectOption("notebook");
  const root = page.locator("[data-gallery-root]");
  const bodyFont = await root.evaluate((element) => getComputedStyle(element).fontFamily);
  expect(bodyFont).toContain("Source Serif 4");
  expect(await page.locator("[data-preview-heading]").first().evaluate((element) => getComputedStyle(element).fontFamily)).toBe(bodyFont);
  expect(await root.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("paper-grain.svg");
  expect(await root.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(251, 247, 237)");
  await page.getByLabel("Mode").selectOption("dark");
  expect(await root.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(32, 31, 26)");
  expect(await root.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("paper-grain.svg");
});
