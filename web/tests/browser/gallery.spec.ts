import { expect, test, type Locator } from "@playwright/test";
import tokens from "../../../contracts/looks/tokens.json" with { type: "json" };
import { tokenNames } from "../../src/registry/token-values.mjs";

async function sampleHeightAcrossFrames(frame: Locator, changeHeightOnFirstFrame = false) {
  return frame.evaluate((element, changeHeight) => {
    const iframe = element as HTMLIFrameElement;
    const root = iframe.contentDocument?.getElementById("root");
    if (!root) return { stable: false, height: 0, contentHeight: 0, firstHeight: 0, firstContentHeight: 0 };
    const read = () => ({ height: Number(iframe.height), contentHeight: root.getBoundingClientRect().height });
    return new Promise<{ stable: boolean; height: number; contentHeight: number; firstHeight: number; firstContentHeight: number }>((resolve) => requestAnimationFrame(() => {
      if (changeHeight) requestAnimationFrame(() => { iframe.height = String(Number(iframe.height) - 30); });
      if (changeHeight) iframe.height = String(Number(iframe.height) + 30);
      const first = read();
      requestAnimationFrame(() => {
        const second = read();
        resolve({
          stable: first.height === second.height && Math.abs(first.height - first.contentHeight) <= 1 && Math.abs(second.height - second.contentHeight) <= 1,
          height: second.height,
          contentHeight: second.contentHeight,
          firstHeight: first.height,
          firstContentHeight: first.contentHeight,
        });
      });
    }));
  }, changeHeightOnFirstFrame);
}

async function waitForStableHeight(frame: Locator) {
  let sample: Awaited<ReturnType<typeof sampleHeightAcrossFrames>> | undefined;
  await expect.poll(async () => {
    sample = await sampleHeightAcrossFrames(frame);
    return sample.stable;
  }).toBe(true);
  return sample!;
}

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

test("base primitives stay in the gallery across token selections", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  const gallery = page.locator("[data-gallery-root]");
  await expect(page.getByRole("region", { name: "Base primitives" })).toBeVisible();
  await expect(gallery.getByText("Inputs and settings")).toBeVisible();
  const marker = page.getByRole("note", { name: "Remembered from your earlier conversation about travel" });
  for (const [label, value, attribute] of [
    ["Look", "default", "data-look"], ["Look", "focused", "data-look"], ["Look", "notebook", "data-look"],
    ["Mode", "light", "data-mode"], ["Mode", "dark", "data-mode"],
    ["Density", "compact", "data-density"], ["Density", "comfortable", "data-density"], ["Density", "spacious", "data-density"],
    ["Text size", "1", "data-text-size"], ["Text size", "2", "data-text-size"], ["Text size", "3", "data-text-size"], ["Text size", "4", "data-text-size"], ["Text size", "5", "data-text-size"],
    ["Screen size", "desktop", "data-device-class"], ["Screen size", "tablet", "data-device-class"],
  ]) {
    await page.getByLabel(label).selectOption(value);
    await expect(gallery).toHaveAttribute(attribute, value);
    await expect(marker).toBeVisible();
    await marker.scrollIntoViewIfNeeded();
    const bounds = await marker.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThan(0);
    expect(bounds!.height).toBeGreaterThan(0);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
  }
});

test("focus rings are painted with 3:1 contrast on shared controls in every look and mode", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  const marker = page.getByRole("note", { name: "Remembered from your earlier conversation about travel" });
  await expect(marker).toBeVisible();
  await expect(marker).toContainText("This answer used saved context.");
  await expect(page.getByRole("button", { name: "Undo marker" })).toBeVisible();
  const parse = (color: string) => {
    const rgb = color.match(/rgba?\(([^)]+)\)/)?.[1];
    if (rgb) return rgb.split(",").slice(0, 3).map((value) => Number.parseFloat(value));
    return color.match(/[\da-f]{2}/gi)!.map((value) => Number.parseInt(value, 16));
  };
  const ratio = (foreground: number[], background: number[], details: string) => {
    const luminance = (rgb: number[]) => rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const values = [luminance(foreground), luminance(background)];
    const result = (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
    expect(result, details).toBeGreaterThanOrEqual(3);
    return result;
  };
  for (const look of ["default", "focused", "notebook"]) {
    await page.getByLabel("Look").selectOption(look);
    for (const mode of ["light", "dark"]) {
      await page.getByLabel("Mode").selectOption(mode);
      const controls = [
        page.getByRole("button", { name: "Continue" }),
        page.getByRole("textbox", { name: "Email" }),
        page.getByRole("textbox", { name: "Notes" }),
        page.getByRole("textbox", { name: "Message" }),
        page.getByRole("checkbox", { name: "Remember this device" }),
        page.getByRole("switch", { name: "Enable notifications" }),
        page.getByRole("combobox", { name: "Theme" }),
        page.getByRole("tab", { name: "Overview" }),
        page.getByRole("slider", { name: "Volume" }),
        page.getByRole("tabpanel", { name: "Overview" }),
        page.getByRole("button", { name: "Undo marker" }),
      ];
      for (const control of controls) {
        await control.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await expect(control).toBeFocused();
        const style = await control.evaluate((element) => {
          const computed = getComputedStyle(element);
          const shadows = [...computed.boxShadow.matchAll(/(rgba?\([^)]+\))\s+-?[\d.]+px\s+-?[\d.]+px\s+-?[\d.]+px\s+(-?[\d.]+)px/g)];
          let surface = element.parentElement;
          while (surface) {
            const color = getComputedStyle(surface).backgroundColor;
            if (!color.startsWith("rgba(") || Number.parseFloat(color.slice(color.lastIndexOf(",") + 1)) > 0) break;
            surface = surface.parentElement;
          }
          return { name: element.getAttribute("aria-label") ?? element.textContent?.trim(), focusVisible: element.matches(":focus-visible"), outlineStyle: computed.outlineStyle, outlineWidth: computed.outlineWidth, outlineColor: computed.outlineColor, shadows: shadows.map(([, color, spread]) => ({ color, spread: Number.parseFloat(spread) })), background: surface ? getComputedStyle(surface).backgroundColor : getComputedStyle(document.documentElement).backgroundColor };
        });
        expect(style.focusVisible).toBe(true);
        const shadow = style.shadows.at(-1);
        const outlineVisible = style.outlineStyle !== "none" && !style.outlineColor.endsWith(", 0)");
        if (outlineVisible) {
          expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThan(0);
          ratio(parse(style.outlineColor), parse(style.background), JSON.stringify(style));
        }
        if (style.shadows.length >= 2) {
          expect(shadow!.spread - style.shadows[0].spread, JSON.stringify(style)).toBeGreaterThan(0);
          ratio(parse(shadow!.color), parse(style.background), JSON.stringify(style));
        } else {
          expect(outlineVisible, JSON.stringify(style)).toBe(true);
          expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThan(0);
          ratio(parse(style.outlineColor), parse(style.background), JSON.stringify(style));
        }
      }
    }
  }
});

test("Marker truncates long labels without horizontal scrolling at 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/tests/browser/gallery.html");
  const marker = page.getByRole("note", { name: "Remembered from your earlier conversation about travel" });
  await marker.evaluate((element) => {
    document.querySelector(".gallery-header")?.remove();
    const card = element.closest(".primitive-gallery-grid > *");
    const grid = card?.parentElement;
    if (grid && card) for (const child of [...grid.children]) if (child !== card) child.remove();
    document.querySelector('[aria-label="Registered Skeletons"]')?.remove();
  });
  const bounds = await marker.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThan(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const label = marker.locator('[data-slot="badge"]');
  expect(await label.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await expect(label).toHaveCSS("text-overflow", "ellipsis");
});

test("desktop Sidebar responds to the token breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/tests/browser/gallery.html");
  const sidebar = page.locator('[data-slot="sidebar-container"]');
  await expect(sidebar).toHaveCSS("display", "flex");
  const bounds = await sidebar.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThan(0);
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1280);
  const screenSize = page.getByLabel("Screen size");
  await screenSize.click();
  await screenSize.selectOption("tablet");
});

test("gallery resets the body margin and Pagination list markers", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  await expect(page.locator("body")).toHaveCSS("margin", "0px");
  await expect(page.locator('[aria-label="pagination"] ul')).toHaveCSS("list-style-type", "none");
  for (const selector of [".primitive-gallery-sidebar", ".primitive-gallery-prompt", '[data-slot="resizable-panel-group"]']) {
    const sample = page.locator(selector);
    const bounds = await sample.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeLessThan(200);
  }
});

test("screen and container breakpoint variants match token thresholds", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/tests/browser/gallery.html");
  const screen = page.locator("[data-screen-breakpoint]");
  const container = page.locator("[data-container-breakpoint]");
  await expect(screen).toHaveCSS("display", "grid");
  await expect(container).toHaveCSS("display", "flex");
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(screen).toHaveCSS("display", "block");
  await page.setViewportSize({ width: 700, height: 900 });
  await expect(screen).toHaveCSS("display", "flex");
  await page.setViewportSize({ width: 400, height: 900 });
  await expect(screen).toHaveCSS("display", "none");
  await expect(container).toHaveCSS("display", "none");
});

test("Resizable handles change panel sizes with keyboard input", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/tests/browser/gallery.html");
  const separator = page.locator('[data-slot="resizable-handle"]');
  const before = await separator.getAttribute("aria-valuenow");
  await separator.focus();
  await page.keyboard.press("ArrowRight");
  await expect(separator).not.toHaveAttribute("aria-valuenow", before ?? "");
});

test("token animation utilities honor reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tests/browser/gallery.html");
  const duration = await page.evaluate(() => {
    const spinner = document.createElement("span");
    spinner.className = "animate-spin";
    document.body.append(spinner);
    return getComputedStyle(spinner).animationDuration.split(",").map((value) => {
      const time = Number.parseFloat(value);
      return value.trim().endsWith("ms") ? time : time * 1000;
    });
  });
  expect(Math.max(...duration)).toBeLessThanOrEqual(0.01);
});

test("all portaled overlays inherit the dark notebook look and stay onscreen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/tests/browser/gallery.html");
  await page.getByLabel("Look").selectOption("notebook");
  await page.getByLabel("Mode").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-texture", "paper-grain");

  const overlays = [
    { trigger: () => page.getByRole("button", { name: "Open dialog" }).click(), content: '[data-slot="dialog-content"]' },
    { trigger: () => page.getByRole("button", { name: "Open sheet" }).click(), content: '[data-slot="sheet-content"]' },
    { trigger: () => page.getByRole("button", { name: "Popover" }).click(), content: '[data-slot="popover-content"]' },
    { trigger: () => page.getByRole("button", { name: "More" }).click(), content: '[data-slot="dropdown-menu-content"]' },
    { trigger: () => page.getByRole("combobox", { name: "Theme" }).click(), content: '[data-slot="select-content"]' },
    { trigger: () => page.getByRole("button", { name: "Help" }).hover(), content: '[data-slot="tooltip-content"]' },
  ];
  for (const { trigger, content } of overlays) {
    await trigger();
    const overlay = page.locator(content);
    await expect(overlay).toBeVisible();
    const style = await overlay.evaluate((element) => {
      const { backgroundColor, fontFamily } = getComputedStyle(element);
      const { x, y, right, bottom, width, height } = element.getBoundingClientRect();
      return { backgroundColor, fontFamily, x, y, right, bottom, width, height };
    });
    expect(style.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(style.fontFamily).toContain("Source Serif 4");
    expect(style.width).toBeGreaterThan(0);
    expect(style.height).toBeGreaterThan(0);
    expect(style.x).toBeGreaterThanOrEqual(0);
    expect(style.y).toBeGreaterThanOrEqual(0);
    expect(style.right).toBeLessThanOrEqual(1280);
    expect(style.bottom).toBeLessThanOrEqual(900);
    await page.keyboard.press("Escape");
    await page.mouse.move(1270, 890);
  }
});

test("primitive surfaces and controls follow token selections", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/tests/browser/gallery.html");
  const styles = () => page.evaluate(() => {
    const card = document.querySelector('[data-slot="card"]')!;
    const input = document.querySelector('[data-slot="input"]')!;
    const button = document.querySelector('[data-slot="button"]')!;
    const ratio = document.querySelector('[data-slot="aspect-ratio"]')!;
    const cardStyle = getComputedStyle(card);
    const inputStyle = getComputedStyle(input);
    const buttonStyle = getComputedStyle(button);
    const { width, height } = ratio.getBoundingClientRect();
    return { card: cardStyle.backgroundColor, inputBorder: inputStyle.borderColor, inputFont: inputStyle.fontFamily, button: buttonStyle.backgroundColor, ratio: width / height };
  });
  const light = await styles();
  expect(light.card).not.toBe("rgba(0, 0, 0, 0)");
  expect(light.inputBorder).not.toBe("rgba(0, 0, 0, 0)");
  expect(light.button).not.toBe("rgba(0, 0, 0, 0)");
  expect(light.ratio).toBeCloseTo(16 / 9, 1);
  await page.getByLabel("Look").selectOption("notebook");
  await page.getByLabel("Mode").selectOption("dark");
  const dark = await styles();
  expect(dark.card).not.toBe(light.card);
  expect(dark.button).not.toBe(light.button);
  expect(dark.inputFont).toContain("Source Serif 4");
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
  await waitForStableHeight(frame);
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

test("waits for the requested fixture before sending its first height", async ({ page }) => {
  let releaseImport!: () => void;
  let importRequested!: () => void;
  const heldImport = new Promise<void>((resolve) => { releaseImport = resolve; });
  const importStarted = new Promise<void>((resolve) => { importRequested = resolve; });
  await page.route("**/ReviewPanel/entry*", async (route) => {
    if (route.request().frame() === page.mainFrame()) return route.continue();
    importRequested();
    const response = await route.fetch();
    await heldImport;
    await route.fulfill({ response });
  });
  await page.goto("/tests/browser/gallery.html", { waitUntil: "commit" });
  const frame = page.locator("iframe[title='ReviewPanel · plain']");
  await expect(frame).toBeAttached();
  await importStarted;
  await frame.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(await frame.getAttribute("height")).toBe("1");
  releaseImport();
  await expect(frame.contentFrame().locator(".review-panel")).toBeVisible();
  await expect.poll(() => frame.getAttribute("height").then(Number)).toBeGreaterThan(1);
  const sample = await waitForStableHeight(frame);
  expect(sample.height).toBeGreaterThan(1);
});

test("waits for fonts requested by a new look before reporting height", async ({ page }) => {
  let releaseFont!: () => void;
  let sourceSerifRequested!: () => void;
  const heldFont = new Promise<void>((resolve) => { releaseFont = resolve; });
  const fontRequested = new Promise<void>((resolve) => { sourceSerifRequested = resolve; });
  await page.addInitScript(() => {
    const messages: { source: MessageEventSource | null; height: number }[] = [];
    window.addEventListener("message", (event: MessageEvent) => {
      if (event.data?.type === "preview-height") messages.push({ source: event.source, height: event.data.height });
    });
    (window as Window & { __previewHeightMessages?: typeof messages }).__previewHeightMessages = messages;
  });
  await page.route("**/fonts/source-serif-4/SourceSerif4.ttf", async (route) => {
    const response = await route.fetch();
    sourceSerifRequested();
    await heldFont;
    await route.fulfill({ response });
  });
  await page.goto("/tests/browser/gallery.html");
  const frame = page.locator("iframe[title='ReviewPanel · plain']");
  await expect(frame.contentFrame().locator(".review-panel")).toBeVisible();
  await waitForStableHeight(frame);
  const messageCount = () => page.evaluate(() => {
    const iframe = document.querySelector("iframe[title='ReviewPanel · plain']") as HTMLIFrameElement;
    return (window as Window & { __previewHeightMessages?: { source: MessageEventSource | null; height: number }[] }).__previewHeightMessages?.filter(({ source }) => source === iframe.contentWindow).length ?? 0;
  });
  const initialMessageCount = await messageCount();
  await page.getByLabel("Look").selectOption("notebook");
  await fontRequested;
  const frameRoot = frame.contentFrame().locator("html");
  await expect(frameRoot).toHaveAttribute("data-look", "notebook");
  await page.getByLabel("Text size").selectOption("5");
  await expect(frameRoot).toHaveAttribute("data-text-size", "5");
  expect(await frame.evaluate((element) => (element as HTMLIFrameElement).contentDocument?.fonts.status)).toBe("loading");
  await frame.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(await messageCount()).toBe(initialMessageCount);
  releaseFont();
  await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentDocument?.fonts.status)).toBe("loaded");
  expect(await messageCount()).toBeGreaterThan(initialMessageCount);
  const sample = await waitForStableHeight(frame);
  expect(Math.abs(sample.height - sample.contentHeight)).toBeLessThanOrEqual(1);
});

test("fits short and tall content by sizing iframes from their document", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  for (const [state, comparison] of [["busy", (height: number) => height < 900], ["tall", (height: number) => height > 900]] as const) {
    const frame = page.locator(`iframe[title='ReviewPanel · ${state}']`);
    await expect(frame.contentFrame().locator("html")).toHaveAttribute("data-text-size", "3");
    await expect(frame.contentFrame().locator(".review-panel")).toBeVisible();
    const sample = await waitForStableHeight(frame);
    const dimensions = await frame.evaluate((element) => {
      const iframe = element as HTMLIFrameElement;
      const stage = iframe.parentElement!;
      return { height: Number(iframe.height), displayedHeight: iframe.getBoundingClientRect().height, stageHeight: stage.clientHeight };
    });
    expect(dimensions.height).toBe(sample.height);
    expect(Math.abs(sample.height - sample.contentHeight)).toBeLessThanOrEqual(1);
    expect(comparison(sample.height)).toBe(true);
    expect(Math.abs(dimensions.displayedHeight - dimensions.stageHeight)).toBeLessThan(2);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
});

test("height stability rejects a mismatch on the first animation frame", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  const frame = page.locator("iframe[title='ReviewPanel · plain']");
  await expect(frame.contentFrame().locator(".review-panel")).toBeVisible();
  await waitForStableHeight(frame);
  const sample = await sampleHeightAcrossFrames(frame, true);
  expect(sample.stable).toBe(false);
  expect(Math.abs(sample.firstHeight - sample.firstContentHeight)).toBeGreaterThan(1);
  expect(Math.abs(sample.height - sample.contentHeight)).toBeLessThanOrEqual(1);
});

test("iframe height shrinks after text size changes from 5 to 1", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  const frame = page.locator("iframe[title='ReviewPanel · plain']");
  const frameRoot = frame.contentFrame().locator("html");
  await expect(frame.contentFrame().locator(".review-panel")).toBeVisible();
  await frame.evaluate((element) => {
    const iframe = element as HTMLIFrameElement;
    const root = iframe.contentDocument!.documentElement;
    const snapshots: { textSize: string | undefined; textScale: string }[] = [];
    new MutationObserver((records) => {
      if (records.some(({ attributeName }) => attributeName === "data-text-size")) snapshots.push({
        textSize: root.dataset.textSize,
        textScale: getComputedStyle(root).getPropertyValue("--text-scale").trim(),
      });
    }).observe(root, { attributes: true, attributeFilter: ["data-text-size"] });
    (iframe.contentWindow as Window & { __previewRootSettings?: typeof snapshots }).__previewRootSettings = snapshots;
  });
  await page.getByLabel("Text size").selectOption("5");
  await expect(frameRoot).toHaveAttribute("data-text-size", "5");
  await expect.poll(() => frame.evaluate((element) => {
    const iframe = element as HTMLIFrameElement;
    return (iframe.contentWindow as (Window & { __previewRootSettings?: { textSize: string | undefined; textScale: string }[] }) | null)?.__previewRootSettings?.some(({ textSize }) => textSize === "5") ?? false;
  })).toBe(true);
  const firstTextSizeApplication = await frame.evaluate((element) => {
    const iframe = element as HTMLIFrameElement;
    return (iframe.contentWindow as (Window & { __previewRootSettings?: { textSize: string | undefined; textScale: string }[] }) | null)?.__previewRootSettings?.find(({ textSize }) => textSize === "5");
  });
  expect(firstTextSizeApplication?.textScale).toBe(tokens.derivedTokens.textSize["5"]["--text-scale"]);
  const largeSample = await waitForStableHeight(frame);
  const largeHeight = largeSample.height;
  await page.getByLabel("Text size").selectOption("1");
  await expect(frameRoot).toHaveAttribute("data-text-size", "1");
  const smallSample = await waitForStableHeight(frame);
  const smallHeight = smallSample.height;
  expect(smallHeight).toBeLessThan(largeHeight);
});

test("ignores forged preview height messages from the parent window", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  const frame = page.locator("iframe[title='ReviewPanel · plain']");
  await expect(frame.contentFrame().locator("html")).toHaveAttribute("data-text-size", "3");
  await expect(frame.contentFrame().locator(".review-panel")).toBeVisible();
  const sample = await waitForStableHeight(frame);
  const height = sample.height;
  await page.evaluate(() => window.postMessage({ type: "preview-height", height: 9999 }, location.origin));
  await expect(frame).toHaveAttribute("height", String(height));
});

test("production build includes and serves the preview page", async ({ page }) => {
  const port = Number((globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.GALLERY_PREVIEW_PORT ?? 4174);
  const response = await page.goto(`http://127.0.0.1:${port}/preview.html?entry=missing&state=plain`);
  expect(response?.status()).toBe(200);
  await page.evaluate(() => window.postMessage({ styles: "", texture: "none", look: "default", mode: "light", density: "comfortable", textSize: "3", deviceClass: "desktop" }, location.origin));
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
    senderScript.textContent = "targetPreview.postMessage({ styles: '--foreground: rgb(255, 0, 0)', texture: 'paper-grain', look: 'default', mode: 'light', density: 'comfortable', textSize: '3', deviceClass: 'desktop' }, location.origin)";
    sender.contentDocument!.body.append(senderScript);
  });
  await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentDocument?.documentElement.dataset.messageSeen)).toBe("yes");
  expect(await frame.evaluate((element) => (element as HTMLIFrameElement).contentDocument?.documentElement.dataset.texture)).toBe("none");
});

test("Notebook applies its bundled body font, paper texture, and both mode palettes without changing Skeleton headings", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  await page.getByLabel("Look").selectOption("notebook");
  const frame = page.locator("iframe[title='ReviewPanel · plain']");
  await expect(frame.contentFrame().locator("html")).toHaveAttribute("data-look", "notebook");
  await waitForStableHeight(frame);
  const root = page.locator("[data-gallery-root]");
  const bodyFont = await root.evaluate((element) => getComputedStyle(element).fontFamily);
  expect(bodyFont).toContain("Source Serif 4");
  const previewHeading = page.frameLocator("iframe[title='ReviewPanel · plain']").locator("[data-preview-heading]");
  const previewBodyFont = await frame.contentFrame().locator("body").evaluate((element) => getComputedStyle(element).fontFamily);
  expect(await previewHeading.evaluate((element) => getComputedStyle(element).fontFamily)).toBe(previewBodyFont);
  for (const size of ["1", "2", "3", "4", "5"] as const) {
    await page.getByLabel("Text size").selectOption(size);
    const actual = Number.parseFloat(await previewHeading.evaluate((element) => getComputedStyle(element).fontSize));
    const expected = Number.parseFloat(tokens.derivedTokens.textSize[size].headings["--heading-2"]) * 16;
    expect(actual).toBeCloseTo(expected, 1);
  }
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


test("content skeletons render every declared gallery state across gallery settings", async ({ page }) => {
  await page.goto("/");
  const cards = await page.locator(".gallery-card[data-skeleton]").evaluateAll((elements) => elements.map((element) => ({
    name: element.getAttribute("data-skeleton")!,
    state: element.getAttribute("data-gallery-state")!,
  })));
  const names = new Set(cards.map(({ name }) => name));
  expect(names).toEqual(new Set(["DataTable", "DataChart", "CodeBlock", "MediaPlayer", "ArtifactWorkspace", "Checklist", "List", "Metric", "Tabs", "Card"]));
  for (const { name, state } of cards) {
    const frame = page.frameLocator(`iframe[title="${name} · ${state}"]`);
    await expect(page.locator(`iframe[title="${name} · ${state}"]`)).toBeVisible();
    await expect(frame.locator("#root")).not.toContainText("Preview unavailable");
    await expect(frame.locator("#root")).not.toContainText("preview failed");
  }

  await page.getByLabel("Look").selectOption("notebook");
  await page.getByLabel("Mode").selectOption("dark");
  await page.getByLabel("Density").selectOption("spacious");
  await page.getByLabel("Text size").selectOption("5");
  await page.getByLabel("Screen size").selectOption("tablet");
  await expect(page.locator("[data-gallery-root]")).toHaveAttribute("data-look", "notebook");
  await expect(page.locator("[data-gallery-root]")).toHaveAttribute("data-mode", "dark");
  await expect(page.locator("[data-gallery-root]")).toHaveAttribute("data-device-class", "tablet");
  await expect(page.frameLocator('iframe[title="DataTable · default"]').locator("html")).toHaveAttribute("data-mode", "dark");
  await expect(page.frameLocator('iframe[title="DataTable · default"]').locator("table")).toBeVisible();
  await expect(page.frameLocator('iframe[title="Tabs · default"]').getByRole("tablist")).toBeVisible();
  const chartView = page.frameLocator('iframe[title="DataTable · chart"]');
  await expect(chartView.locator("svg")).toBeVisible();
  await expect(chartView.getByText("January: 120")).toBeAttached();
  await expect(page.frameLocator('iframe[title="DataChart · long_content"]').locator("svg")).toBeVisible();
  await expect(page.frameLocator('iframe[title="CodeBlock · diff"]').locator("pre")).toContainText("current");
  await expect(page.frameLocator('iframe[title="CodeBlock · stack_trace"]').getByRole("button", { name: /TypeError/ })).toBeVisible();
  await expect(page.frameLocator('iframe[title="CodeBlock · terminal"]').locator("[role=region] .text-terminal-success")).toContainText("All tests passed");
  const checklist = page.frameLocator('iframe[title="Checklist · default"]');
  const checkbox = checklist.getByRole("checkbox").first();
  await checkbox.click();
  await expect(checkbox).toHaveAttribute("aria-checked", "false");
  const tabs = page.frameLocator('iframe[title="Tabs · default"]');
  await tabs.getByRole("tab", { name: "Details" }).click();
  await expect(tabs.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  for (const device of ["desktop", "tablet"] as const) {
    await page.getByLabel("Screen size").selectOption(device);
    for (const name of names) {
      const frame = page.locator(`iframe[title^="${name} · "]`).first();
      await expect(frame).toBeVisible();
      await expect(frame.contentFrame().locator("#root")).not.toContainText("Preview unavailable");
      await expect(frame.contentFrame().locator("#root")).not.toContainText("preview failed");
    }
  }
});


test("content skeletons survive every gallery setting combination", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.locator("iframe").evaluateAll((frames) => frames.some((frame) => frame.getAttribute("title")?.startsWith("DataTable ·")) && frames.filter((frame) => ["DataTable", "DataChart", "CodeBlock", "MediaPlayer", "ArtifactWorkspace", "Checklist", "List", "Metric", "Tabs", "Card"].some((name) => frame.getAttribute("title")?.startsWith(`${name} · `))).every((frame) => {
    const root = (frame as HTMLIFrameElement).contentDocument?.querySelector("#root");
    return !!root && !/Preview unavailable|preview failed/.test(root.textContent ?? "");
  })), { timeout: 30000 }).toBe(true);
  const looks = ["default", "focused", "notebook"] as const;
  const densities = ["compact", "comfortable", "spacious"] as const;
  const sizes = ["1", "2", "3", "4", "5"] as const;
  const modes = ["light", "dark"] as const;
  const devices = ["desktop", "tablet"] as const;
  const skeletonNames = ["DataTable", "DataChart", "CodeBlock", "MediaPlayer", "ArtifactWorkspace", "Checklist", "List", "Metric", "Tabs", "Card"];
  let combinations = 0;
  for (const device of devices) for (const look of looks) for (const mode of modes) for (const density of densities) for (const textSize of sizes) {
    for (const [label, value] of [["Look", look], ["Mode", mode], ["Density", density], ["Text size", textSize], ["Screen size", device]]) {
      const select = page.getByLabel(label);
      if (await select.inputValue() !== value) await select.selectOption(value);
    }
    const expected = { names: skeletonNames, look, mode, density, densitySpace: tokens.derivedTokens.density[density]["--space-1"], checkTokens: textSize === "1" && device === "desktop", checkReadiness: textSize === "1" && density === "compact" && mode === "light" && device === "desktop", textSize, width: device === "tablet" ? 800 : 1440 };
    await expect.poll(() => page.evaluate(async ({ names, density, densitySpace, checkTokens, checkReadiness, ...settings }) => {
      const gallery = document.querySelector("[data-gallery-root]");
      if (!gallery || Object.entries(settings).some(([key, value]) => gallery.getAttribute(`data-${key === "textSize" ? "text-size" : key === "width" ? "device-class" : key}`) !== (key === "width" ? (value === 800 ? "tablet" : "desktop") : value))) return "gallery settings";
      const frames = [...document.querySelectorAll<HTMLIFrameElement>("iframe")].filter((frame) => names.some((name) => frame.title.startsWith(`${name} · `)));
      if (!frames.length) return "no frames";
      for (const [index, frame] of frames.entries()) {
        const doc = frame.contentDocument;
        const root = doc?.querySelector<HTMLElement>("#root");
        const html = doc?.documentElement;
        if (!doc || !root?.children.length || !root.textContent?.trim() || !html) return `${frame.title}: content`;
        if (html.dataset.look !== settings.look || html.dataset.mode !== settings.mode || html.dataset.density !== density || html.dataset.textSize !== settings.textSize || frame.contentWindow?.innerWidth !== settings.width) return `${frame.title}: settings ${JSON.stringify({look:html.dataset.look,mode:html.dataset.mode,density:html.dataset.density,textSize:html.dataset.textSize,width:frame.contentWindow?.innerWidth})}`;
        if (index === 0 && checkTokens) {
          const style = getComputedStyle(html);
          if (style.getPropertyValue("--space-1").trim() !== densitySpace) return `${frame.title}: density token`;
          if (checkReadiness && doc.fonts.status !== "loaded") return `${frame.title}: fonts not ready`;
          if (checkReadiness && (!style.color || !style.backgroundColor)) return `${frame.title}: style`;
          if (checkReadiness && Math.abs(Number(frame.height) - root.getBoundingClientRect().height) > 1) return `${frame.title}: unstable frame height`;
        }
      }
      return "ready";
    }, expected), `${look}/${mode}/${density}/${textSize}/${device}`).toBe("ready");
    combinations++;
  }
  expect(combinations).toBe(180);
});

test("content controls use their host, show focus rings, preserve list markers, and apply chart tokens", async ({ page }) => {
  await page.goto("/");
  const table = page.frameLocator('iframe[title="DataTable · default"]');
  const tableButton = table.getByRole("button", { name: "Table" });
  await tableButton.focus();
  expect(await tableButton.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
  await page.keyboard.press("Tab");
  const chartButton = table.getByRole("button", { name: "Chart" });
  await expect(chartButton).toBeFocused();
  expect(await chartButton.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
  await chartButton.click();
  await expect(chartButton).toHaveAttribute("aria-pressed", "true");
  await expect(table.locator("svg")).toBeVisible();

  const checklist = page.frameLocator('iframe[title="Checklist · default"]');
  const checkbox = checklist.getByRole("checkbox").nth(1);
  await checklist.getByText("Share with team").click();
  await expect(checkbox).toHaveAttribute("aria-checked", "true");
  await checkbox.press("Space");
  await expect(checkbox).toHaveAttribute("aria-checked", "false");
  expect(await checkbox.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");

  const tabs = page.frameLocator('iframe[title="Tabs · default"]');
  await tabs.getByRole("tab", { name: "Overview" }).focus();
  await tabs.getByRole("tab", { name: "Overview" }).press("End");
  await expect(tabs.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  const listItem = page.frameLocator('iframe[title="List · default"]').locator("li").first();
  await expect(listItem).toHaveCSS("display", "list-item");
  await expect(listItem).toHaveCSS("list-style-type", "disc");

  const chart = page.frameLocator('iframe[title="DataChart · default"]');
  await chart.locator(".recharts-bar-rectangle").first().hover();
  const tooltip = chart.locator(".recharts-tooltip-wrapper .recharts-default-tooltip");
  await expect(tooltip).toBeVisible();
  const style = await tooltip.evaluate((element) => ({ padding: element.getAttribute("style"), border: element.getAttribute("style") }));
  expect(style.padding).toContain("var(--space-3)");
  expect(style.border).toContain("var(--border-width)");
  await expect(chart.locator(".recharts-tooltip-cursor")).toHaveAttribute("stroke", "var(--border)");
  const fill = await chart.locator(".recharts-bar-rectangle path").first().evaluate((element) => ({ computed: getComputedStyle(element).fill, attr: element.getAttribute("fill") }));
  const series = await chart.locator("html").evaluate((element) => getComputedStyle(element).getPropertyValue("--chart-1").trim());
  const normalizedSeries = await chart.locator("html").evaluate((element, value) => {
    const probe = document.createElement("span");
    probe.style.color = value;
    element.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, series);
  expect(fill.attr).toBe("var(--chart-1)");
  expect(fill.computed).toBe(normalizedSeries);
});

test("rendered code, diff, stack trace and terminal text stay readable in every look and mode", async ({ page }) => {
  await page.goto("/");
  const ratio = (foreground: string, background: string) => {
    const luminance = (input: string) => {
      const rgb = input.match(/[\d.]+/g)?.slice(0, 3).map(Number);
      if (!rgb || rgb.length !== 3) return 0;
      const channels = rgb.map((channel) => { const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
    };
    const a = luminance(foreground); const b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  for (const look of ["default", "focused", "notebook"]) {
    await page.getByLabel("Look").selectOption(look);
    for (const mode of ["light", "dark"]) {
      await page.getByLabel("Mode").selectOption(mode);
      for (const state of ["default", "diff"] as const) {
        const frame = page.frameLocator(`iframe[title="CodeBlock · ${state}"]`);
        const code = frame.locator("pre code");
        await expect(code).toBeVisible();
        if (state === "diff") {
          await expect(code).toContainText("const old");
          await expect(code).toContainText("const current");
          const colors = await code.locator(":scope > span.block").evaluateAll((lines) => lines.filter((line) => line.textContent?.includes("const old") || line.textContent?.includes("const current")).map((line) => getComputedStyle(line.querySelector("span")!).color));
          expect(colors).toHaveLength(2);
          expect(colors[0]).not.toBe(colors[1]);
        }
        const colors = await frame.locator("pre code span[class*='text-code-']").evaluateAll((nodes) => nodes.filter((node) => node.textContent?.trim()).map((node) => ({ color: getComputedStyle(node).color, background: getComputedStyle(node.closest("pre")!).backgroundColor })));
        expect(colors.length, `${look}/${mode}/${state} rendered syntax`).toBeGreaterThan(0);
        for (const { color, background } of colors) expect(ratio(color, background), `${look}/${mode}/${state}: ${color} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
      const stack = page.frameLocator('iframe[title="CodeBlock · stack_trace"]');
      const stackColors = await stack.locator("button").evaluate((element) => ({ color: getComputedStyle(element.querySelector("span.text-code-foreground")!).color, background: getComputedStyle(element).backgroundColor }));
      expect(ratio(stackColors.color, stackColors.background), `${look}/${mode}/stack trace`).toBeGreaterThanOrEqual(4.5);
      const terminal = page.frameLocator('iframe[title="CodeBlock · terminal"]');
      const terminalText = await terminal.locator("[role=region] pre span[class*='text-terminal-']").evaluateAll((nodes) => nodes.map((element) => ({ role: element.className, color: getComputedStyle(element).color, background: getComputedStyle(element.closest("[role=region]")!).backgroundColor })));
      expect(terminalText.map(({ role }) => role)).toEqual(expect.arrayContaining(["text-terminal-success", "text-terminal-warning", "text-terminal-error", "text-terminal-info"]));
      for (const { color, background } of terminalText) expect(ratio(color, background), `${look}/${mode}/terminal`).toBeGreaterThanOrEqual(4.5);

      const traceTrigger = stack.getByRole("button");
      const controls = await traceTrigger.getAttribute("aria-controls");
      expect(controls).toBeTruthy();
      await expect(stack.locator(`#${controls}`)).toBeAttached();

      const lineChart = page.frameLocator('iframe[title="DataChart · long_content"]');
      const line = lineChart.locator(".recharts-line-curve");
      await expect(line).toHaveAttribute("stroke", "var(--chart-1)");
      await expect(line).toHaveAttribute("stroke-width", "1");
      const dot = lineChart.locator(".recharts-dot").first();
      await expect(dot).toHaveAttribute("stroke", "var(--chart-1)");
      await expect(dot).toHaveAttribute("fill", "var(--chart-1)");
      const dotRadius = await lineChart.locator("html").evaluate((html) => {
        const style = getComputedStyle(html);
        return Number.parseFloat(style.getPropertyValue("--space-2")) * Number.parseFloat(style.fontSize);
      });
      expect(Number(await dot.getAttribute("r"))).toBe(dotRadius);
      await expect(dot).toBeVisible();
      await dot.scrollIntoViewIfNeeded();
      const dotBox = await dot.boundingBox();
      expect(dotBox).not.toBeNull();
      await page.mouse.move(dotBox!.x + dotBox!.width / 2, dotBox!.y + dotBox!.height / 2);
      const activeDot = lineChart.locator(".recharts-active-dot circle").first();
      await expect(activeDot).toHaveAttribute("fill", "var(--chart-1)");
      await expect(activeDot).toHaveAttribute("stroke", "var(--foreground)");
      const activeRadius = await lineChart.locator("html").evaluate((html) => {
        const style = getComputedStyle(html);
        return Number.parseFloat(style.getPropertyValue("--space-3")) * Number.parseFloat(style.fontSize);
      });
      expect(Number(await activeDot.getAttribute("r"))).toBe(activeRadius);
      await expect(lineChart.locator(".recharts-tooltip-cursor")).toHaveAttribute("stroke", "var(--border)");
    }
  }
  const stackHeader = page.frameLocator('iframe[title="CodeBlock · stack_trace"]').locator("button");
  await stackHeader.press("Enter");
  expect(await stackHeader.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
});

test("long terminal logs stay inside the token-bounded scroll region", async ({ page }) => {
  await page.goto("/");
  const frame = page.frameLocator('iframe[title="CodeBlock · terminal_long"]');
  const content = frame.getByRole("region", { name: "Terminal output" }).locator('[tabindex="0"]');
  await expect(content).toContainText("Info: log line 200");
  await expect.poll(() => content.evaluate((element) => ({ maxHeight: getComputedStyle(element).maxHeight, overflowY: getComputedStyle(element).overflowY, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }))).toMatchObject({ maxHeight: "640px", overflowY: "auto" });
  expect(await content.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
});
