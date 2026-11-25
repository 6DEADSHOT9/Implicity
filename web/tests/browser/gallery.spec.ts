import { expect, test } from "@playwright/test";
import { tokenNames } from "../../src/registry/token-values.mjs";

test("screen size changes actual Skeleton preview width and all allowed tokens are set", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  const preview = page.frameLocator("iframe[title='ReviewPanel · plain']").locator(".review-panel");
  const desktop = await preview.boundingBox();
  expect(desktop).not.toBeNull();
  await page.getByLabel("Screen size").selectOption("tablet");
  const tablet = await preview.boundingBox();
  expect(tablet).not.toBeNull();
  expect(desktop!.width).toBeGreaterThan(tablet!.width);

  const customProperties = [...tokenNames].filter((name) => name.startsWith("--"));
  const missing = await page.frameLocator("iframe[title='ReviewPanel · plain']").locator("html").evaluate((element, names) => {
    const style = getComputedStyle(element);
    return names.filter((name) => !style.getPropertyValue(name).trim());
  }, customProperties);
  expect(missing).toEqual([]);
});

test("tablet changes the viewport and media-query layout seen by Skeletons", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  const previewFrame = page.locator("iframe[title='ReviewPanel · plain']");
  const preview = page.frameLocator("iframe[title='ReviewPanel · plain']").locator(".review-panel");
  await expect.poll(() => previewFrame.evaluate((frame) => (frame as HTMLIFrameElement).contentWindow?.innerWidth)).toBe(1440);
  await expect(preview).toHaveCSS("display", "grid");
  await expect(page.frameLocator("iframe[title='ReviewPanel · plain']").locator("[data-match-media]")).toHaveText("wide");
  await page.getByLabel("Screen size").selectOption("tablet");
  await expect.poll(() => previewFrame.evaluate((frame) => (frame as HTMLIFrameElement).contentWindow?.innerWidth)).toBe(800);
  await expect(preview).toHaveCSS("display", "flex");
  await expect(page.frameLocator("iframe[title='ReviewPanel · plain']").locator("[data-match-media]")).toHaveText("narrow");
});

test("tablet viewport stays fixed when text size changes and previews fit their cards", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  await page.getByLabel("Screen size").selectOption("tablet");
  const frame = page.locator("iframe[title='ReviewPanel · plain']");
  await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentWindow?.innerWidth)).toBe(800);
  await expect(frame).toHaveAttribute("width", "800");
  await page.getByLabel("Text size").selectOption("1");
  await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentWindow?.innerWidth)).toBe(800);
  await expect(page.frameLocator("iframe[title='ReviewPanel · plain']").locator("[data-match-media]")).toHaveText("narrow");
  const bounds = await page.locator("[data-skeleton='ReviewPanel'][data-gallery-state='plain'] .gallery-preview").boundingBox();
  const displayed = await frame.boundingBox();
  expect(displayed && bounds && displayed.width).toBeLessThanOrEqual(bounds!.width + 1);
  expect(bounds && displayed && displayed.x + displayed.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
});

test("renders examples and contains a failed Skeleton state to its card", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  await expect(page.frameLocator("iframe[title='ReviewPanel · plain']").locator("body")).toContainText("1one");
  await expect(page.frameLocator("iframe[title='ReviewPanel · busy']").locator("body")).toContainText("4twothree");
  await expect(page.frameLocator("iframe[title='ReviewShell · plain']").locator("body")).toContainText("content");
  await expect(page.frameLocator("iframe[title='ReviewPanel · error']").getByRole("alert")).toContainText("ReviewPanel · error: preview failed");
  await expect(page.locator("[data-skeleton='ReviewPanel'][data-gallery-state='plain']")).toBeVisible();
});

test("Notebook applies its bundled body font, paper texture, and both mode palettes without changing Skeleton headings", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  await page.getByLabel("Look").selectOption("notebook");
  const root = page.locator("[data-gallery-root]");
  const bodyFont = await root.evaluate((element) => getComputedStyle(element).fontFamily);
  expect(bodyFont).toContain("Source Serif 4");
  const previewHeading = page.frameLocator("iframe[title='ReviewPanel · plain']").locator("[data-preview-heading]");
  const previewBodyFont = await page.frameLocator("iframe[title='ReviewPanel · plain']").locator("body").evaluate((element) => getComputedStyle(element).fontFamily);
  expect(await previewHeading.evaluate((element) => getComputedStyle(element).fontFamily)).toBe(previewBodyFont);
  expect(await previewHeading.evaluate((element) => getComputedStyle(element).fontSize)).toBe("27px");
  expect(await root.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("paper-grain.svg");
  const textureDetails = async () => page.frameLocator("iframe[title='ReviewPanel · plain']").locator("html").evaluate(async (element) => {
    const url = getComputedStyle(element).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
    if (!url) return null;
    const image = new Image();
    image.src = url;
    await image.decode();
    return [url, image.naturalWidth, image.naturalHeight, getComputedStyle(element).backgroundColor];
  });
  expect((await textureDetails())?.slice(0, 1)[0]).toMatch(/\/textures\/paper-grain\.svg$/);
  expect((await textureDetails())?.slice(1)).toEqual([160, 160, "rgb(251, 247, 237)"]);
  expect(await root.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(251, 247, 237)");
  await page.getByLabel("Mode").selectOption("dark");
  expect(await root.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(32, 31, 26)");
  expect(await root.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("paper-grain.svg");
  expect((await textureDetails())?.slice(0, 1)[0]).toMatch(/\/textures\/paper-grain\.svg$/);
  expect((await textureDetails())?.slice(1)).toEqual([160, 160, "rgb(32, 31, 26)"]);
});
