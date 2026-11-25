import { expect, test } from "@playwright/test";
import { tokenNames } from "../../src/registry/token-values.mjs";

test("screen size changes actual Skeleton preview width and all allowed tokens are set", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  const preview = page.frameLocator("iframe[title='ReviewPanel · plain']").locator(".review-panel");
  const desktop = await preview.boundingBox();
  expect(desktop).not.toBeNull();
  expect(desktop!.width).toBeGreaterThan(1000);
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

test("desktop preview scales into its card while keeping a 1440 px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1201, height: 900 });
  await page.goto("/tests/browser/gallery.html");
  const card = page.locator("[data-skeleton='ReviewPanel'][data-gallery-state='plain'] .gallery-preview");
  const frame = page.locator("iframe[title='ReviewPanel · plain']");
  await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentWindow?.innerWidth)).toBe(1440);
  const [cardBounds, frameBounds] = await Promise.all([card.boundingBox(), frame.boundingBox()]);
  expect(cardBounds).not.toBeNull();
  expect(frameBounds).not.toBeNull();
  expect(frameBounds!.x).toBeGreaterThanOrEqual(cardBounds!.x);
  expect(frameBounds!.y).toBeGreaterThanOrEqual(cardBounds!.y);
  expect(frameBounds!.x + frameBounds!.width).toBeLessThanOrEqual(cardBounds!.x + cardBounds!.width + 1);
  expect(frameBounds!.y + frameBounds!.height).toBeLessThanOrEqual(cardBounds!.y + cardBounds!.height + 1);
});

test("renders examples and contains a failed Skeleton state to its card", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  await expect(page.frameLocator("iframe[title='ReviewPanel · plain']").locator("body")).toContainText("1one");
  await expect(page.frameLocator("iframe[title='ReviewPanel · busy']").locator("body")).toContainText("4twothree");
  await expect(page.frameLocator("iframe[title='ReviewShell · plain']").locator("body")).toContainText("content");
  await expect(page.frameLocator("iframe[title='ReviewPanel · error']").getByRole("alert")).toContainText("ReviewPanel · error: preview failed");
  await expect(page.locator("[data-skeleton='ReviewPanel'][data-gallery-state='plain']")).toBeVisible();
  const panelResources = await page.locator("iframe[title='ReviewPanel · plain']").evaluate((frame) => (frame as HTMLIFrameElement).contentWindow?.performance.getEntriesByType("resource").map(({ name }) => name) ?? []);
  const shellResources = await page.locator("iframe[title='ReviewShell · plain']").evaluate((frame) => (frame as HTMLIFrameElement).contentWindow?.performance.getEntriesByType("resource").map(({ name }) => name) ?? []);
  expect(panelResources.some((url) => url.includes("/ReviewPanel/entry.ts"))).toBe(true);
  expect(panelResources.some((url) => url.includes("/ReviewShell/entry.ts"))).toBe(false);
  expect(shellResources.some((url) => url.includes("/ReviewShell/entry.ts"))).toBe(true);
  expect(shellResources.some((url) => url.includes("/ReviewPanel/entry.ts"))).toBe(false);
});

test("fits short and tall content by sizing iframes from their document", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  for (const [state, comparison] of [["busy", (height: number) => height < 900], ["tall", (height: number) => height > 900]] as const) {
    const frame = page.locator(`iframe[title='ReviewPanel · ${state}']`);
    await expect.poll(() => frame.evaluate((element) => {
      const iframe = element as HTMLIFrameElement;
      return Math.abs(Number(iframe.height) - (iframe.contentDocument?.getElementById("root")?.getBoundingClientRect().height ?? 0)) <= 1;
    })).toBe(true);
    const dimensions = await frame.evaluate((element) => {
      const iframe = element as HTMLIFrameElement;
      const stage = iframe.parentElement!;
      return { height: Number(iframe.height), displayedHeight: iframe.getBoundingClientRect().height, stageHeight: stage.clientHeight };
    });
    expect(comparison(dimensions.height)).toBe(true);
    expect(Math.abs(dimensions.displayedHeight - dimensions.stageHeight)).toBeLessThan(2);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
});

test("iframe height shrinks after text size changes from 5 to 1", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  const frame = page.locator("iframe[title='ReviewPanel · plain']");
  const matchesContent = () => frame.evaluate((element) => {
    const iframe = element as HTMLIFrameElement;
    const contentHeight = iframe.contentDocument?.getElementById("root")?.getBoundingClientRect().height ?? 0;
    return Math.abs(Number(iframe.height) - contentHeight) <= 1;
  });
  await page.getByLabel("Text size").selectOption("5");
  await expect.poll(matchesContent).toBe(true);
  const largeHeight = await frame.evaluate((element) => Number((element as HTMLIFrameElement).height));
  await page.getByLabel("Text size").selectOption("1");
  await expect.poll(matchesContent).toBe(true);
  const smallHeight = await frame.evaluate((element) => Number((element as HTMLIFrameElement).height));
  expect(smallHeight).toBeLessThan(largeHeight);
});

test("ignores forged preview height messages from the parent window", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  const frame = page.locator("iframe[title='ReviewPanel · plain']");
  await expect.poll(() => frame.evaluate((element) => {
    const iframe = element as HTMLIFrameElement;
    return Math.abs(Number(iframe.height) - (iframe.contentDocument?.getElementById("root")?.getBoundingClientRect().height ?? 0)) <= 1;
  })).toBe(true);
  const height = await frame.evaluate((element) => Number((element as HTMLIFrameElement).height));
  await page.evaluate(() => window.postMessage({ type: "preview-height", height: 9999 }, location.origin));
  await expect(frame).toHaveAttribute("height", String(height));
});

test("production build includes and serves the preview page", async ({ page }) => {
  const port = Number((globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.GALLERY_PREVIEW_PORT ?? 4174);
  const response = await page.goto(`http://127.0.0.1:${port}/preview.html?entry=missing&state=plain`);
  expect(response?.status()).toBe(200);
  await page.evaluate(() => window.postMessage({ styles: "", texture: "none" }, location.origin));
  await expect(page.getByRole("alert")).toHaveText("Preview unavailable");
});

test("preview ignores styling messages from unrelated same-origin frames", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  const frame = page.locator("iframe[title='ReviewPanel · plain']");
  await expect(page.frameLocator("iframe[title='ReviewPanel · plain']").locator("body")).toContainText("Preview heading");
  await page.evaluate(async () => {
    const target = (document.querySelector("iframe[title='ReviewPanel · plain']") as HTMLIFrameElement).contentWindow!;
    const sender = document.createElement("iframe");
    sender.src = "/tests/browser/preview-frame.html?entry=missing&state=plain";
    document.body.append(sender);
    await new Promise<void>((resolve) => sender.addEventListener("load", () => resolve(), { once: true }));
    const targetScript = target.document.createElement("script");
    targetScript.textContent = "window.addEventListener('message', () => document.documentElement.dataset.messageSeen = 'yes', { once: true })";
    target.document.body.append(targetScript);
    Object.defineProperty(sender.contentWindow!, "targetPreview", { value: target });
    const senderScript = sender.contentDocument!.createElement("script");
    senderScript.textContent = "targetPreview.postMessage({ styles: '--foreground: rgb(255, 0, 0)', texture: 'paper-grain' }, location.origin)";
    sender.contentDocument!.body.append(senderScript);
  });
  await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentDocument?.documentElement.dataset.messageSeen)).toBe("yes");
  expect(await frame.evaluate((element) => (element as HTMLIFrameElement).contentDocument?.documentElement.dataset.texture)).toBe("none");
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
