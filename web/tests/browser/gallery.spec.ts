import { expect, test } from "@playwright/test";
import tokens from "../../../contracts/looks/tokens.json" with { type: "json" };
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

test("base primitives stay in the gallery across token selections", async ({ page }) => {
  await page.goto("/tests/browser/gallery.html");
  const gallery = page.locator("[data-gallery-root]");
  await expect(page.getByRole("region", { name: "Base primitives" })).toBeVisible();
  await expect(gallery.getByText("Inputs and settings")).toBeVisible();
  for (const [label, value, attribute] of [
    ["Look", "notebook", "data-look"],
    ["Mode", "dark", "data-mode"],
    ["Density", "spacious", "data-density"],
    ["Text size", "5", "data-text-size"],
    ["Screen size", "tablet", "data-device-class"],
  ]) {
    await page.getByLabel(label).selectOption(value);
    await expect(gallery).toHaveAttribute(attribute, value);
  }
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
  await expect.poll(() => frame.evaluate((element) => Number((element as HTMLIFrameElement).height))).toBeGreaterThan(50);
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
  await expect(page.frameLocator('iframe[title="CodeBlock · terminal"]').locator(".text-code-foreground")).toContainText("All tests passed");
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
  let combinations = 0;
  for (const look of looks) for (const mode of modes) for (const density of densities) for (const textSize of sizes) for (const device of devices) {
    await page.getByLabel("Look").selectOption(look);
    await page.getByLabel("Mode").selectOption(mode);
    await page.getByLabel("Density").selectOption(density);
    await page.getByLabel("Text size").selectOption(textSize);
    await page.getByLabel("Screen size").selectOption(device);
    const expectedWidth = device === "tablet" ? 800 : 1440;
    await expect.poll(() => page.locator("iframe").evaluateAll((frames, width) => frames.filter((frame) => frame.getAttribute("title")?.includes(" · ")).every((frame) => (frame as HTMLIFrameElement).contentWindow?.innerWidth === width), expectedWidth)).toBe(true);
    await expect.poll(() => page.locator("iframe").evaluateAll((frames) => frames.filter((frame) => frame.getAttribute("title")?.includes(" · ")).every((frame) => {
      const iframe = frame as HTMLIFrameElement;
      return !!iframe.contentDocument?.querySelector("#root")?.children.length;
    }))).toBe(true);
    const rendered = await page.locator("iframe").evaluateAll((frames) => frames
      .filter((frame) => ["DataTable", "DataChart", "CodeBlock", "MediaPlayer", "ArtifactWorkspace", "Checklist", "List", "Metric", "Tabs", "Card"].some((name) => (frame as HTMLIFrameElement).title.startsWith(`${name} · `)))
      .filter((frame) => {
        const iframe = frame as HTMLIFrameElement;
        const root = iframe.contentDocument?.querySelector<HTMLElement>("#root");
        const style = iframe.contentDocument && getComputedStyle(iframe.contentDocument.documentElement);
        return !root?.children.length || !root.textContent?.trim() || iframe.contentDocument?.documentElement.dataset.mode !== document.querySelector("[data-gallery-root]")?.getAttribute("data-mode") || iframe.contentWindow?.innerWidth !== (document.querySelector("[data-gallery-root]")?.getAttribute("data-device-class") === "tablet" ? 800 : 1440) || !style?.color || !style.backgroundColor;
      }).map((frame) => (frame as HTMLIFrameElement).title));
    expect(rendered, `${look}/${mode}/${density}/${textSize}/${device}`).toEqual([]);
    combinations++;
  }
  expect(combinations).toBe(180);
});

test("content controls use their host, preserve list markers, and apply chart tokens", async ({ page }) => {
  await page.goto("/");
  const table = page.frameLocator('iframe[title="DataTable · default"]');
  const tableButton = table.getByRole("button", { name: "Table" });
  await tableButton.focus();
  await page.keyboard.press("Tab");
  const chartButton = table.getByRole("button", { name: "Chart" });
  await expect(chartButton).toBeFocused();

  const checklist = page.frameLocator('iframe[title="Checklist · default"]');
  const checkbox = checklist.getByRole("checkbox").nth(1);
  await checklist.getByText("Share with team").click();
  await expect(checkbox).toHaveAttribute("aria-checked", "true");

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
        }
        const colors = await frame.locator("pre code span[class*='text-code-']").evaluateAll((nodes) => nodes.filter((node) => node.textContent?.trim()).map((node) => ({ color: getComputedStyle(node).color, background: getComputedStyle(node.closest("pre")!).backgroundColor })));
        expect(colors.length, `${look}/${mode}/${state} rendered syntax`).toBeGreaterThan(0);
        for (const { color, background } of colors) expect(ratio(color, background), `${look}/${mode}/${state}: ${color} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
      const stack = page.frameLocator('iframe[title="CodeBlock · stack_trace"]');
      const stackColors = await stack.locator("button").evaluate((element) => ({ color: getComputedStyle(element.querySelector("span.text-code-foreground")!).color, background: getComputedStyle(element).backgroundColor }));
      expect(ratio(stackColors.color, stackColors.background), `${look}/${mode}/stack trace`).toBeGreaterThanOrEqual(4.5);
      const terminal = page.frameLocator('iframe[title="CodeBlock · terminal"]');
      const terminalColors = await terminal.locator(".bg-code-background").evaluate((element) => ({ color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
      expect(ratio(terminalColors.color, terminalColors.background), `${look}/${mode}/terminal`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
