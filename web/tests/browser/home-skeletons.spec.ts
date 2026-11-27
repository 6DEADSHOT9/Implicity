import { expect, test } from "@playwright/test";

const homeEntries = [
  ["HomeGrid", "long-content"],
  ["WidgetFrame", "long-content"],
  ["ResumeWidget", "long-content"],
  ["ProjectsWidget", "long-content"],
  ["ScheduledWidget", "long-content"],
  ["QuickPromptsWidget", "long-content"],
  ["NowPlayingWidget", "long-content"],
] as const;

async function expectHomeTitlesFit(page: import("@playwright/test").Page) {
  const pickerPreview = page.frameLocator('iframe[title="WidgetPicker · long-content"]');
  const pickerDialog = pickerPreview.locator("[data-widget-picker-dialog]");
  if (!(await pickerDialog.count())) await pickerPreview.getByRole("button", { name: "Customize" }).click();
  const result = await page.waitForFunction((entries) => {
    const frames = Array.from(document.querySelectorAll("iframe"));
    const previews = entries.map(([id, state]) => {
      const isBuiltin = ["ResumeWidget", "ProjectsWidget", "ScheduledWidget", "QuickPromptsWidget", "NowPlayingWidget"].includes(id);
      const frame = frames.find((item) => item.title === `${id} · ${state}`);
      const frameDocument = frame?.contentDocument;
      const element = frameDocument?.querySelector(isBuiltin ? '[role="list"]' : "h1, h2");
      if (!frameDocument || !element || element.getBoundingClientRect().width === 0) return false;
      const rect = element.getBoundingClientRect();
      const root = frameDocument.documentElement;
      const textNodes: Array<{ length: number; rects: Array<{ left: number; right: number }>; bounds: { left: number; right: number } }> = [];
      const walker = frameDocument.createTreeWalker(frameDocument.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if ((node.textContent?.length ?? 0) < 64) continue;
        const range = frameDocument.createRange();
        range.selectNodeContents(node);
        const card = node.parentElement?.closest("[data-slot=card]");
        const box = (card ?? root).getBoundingClientRect();
        textNodes.push({ length: node.textContent?.length ?? 0, rects: Array.from(range.getClientRects(), ({ left, right }) => ({ left, right })), bounds: { left: box.left, right: box.right } });
      }
      return { id, width: rect.width, left: rect.left, right: rect.right, viewport: frameDocument.defaultView!.innerWidth, scrollWidth: root.scrollWidth, textNodes };
    });
    const frame = frames.find((item) => item.title === "WidgetPicker · long-content");
    const picker = frame?.contentDocument?.querySelector("[data-widget-picker-dialog]");
    if (previews.some((preview) => !preview) || !frame || !picker || picker.getBoundingClientRect().width === 0) return false;
    const rect = picker.getBoundingClientRect();
    if (Number(frame.height) < rect.bottom) return false;
    const titleElement = picker.querySelector("[data-widget-picker-title]")!;
    const title = titleElement.getBoundingClientRect();
    const range = picker.ownerDocument.createRange();
    range.selectNodeContents(titleElement);
    const titleLines = Array.from(range.getClientRects(), ({ left, right }) => ({ left, right }));
    return { previews, picker: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: picker.ownerDocument.defaultView!.innerWidth, height: picker.ownerDocument.defaultView!.innerHeight, titleLeft: title.left, titleRight: title.right, titleLines, frameHeight: Number(frame.height) } };
  }, homeEntries);
  const { previews, picker: bounds } = await result.jsonValue() as {
    previews: Array<{ id: string; width: number; left: number; right: number; viewport: number; scrollWidth: number; textNodes: Array<{ length: number; rects: Array<{ left: number; right: number }>; bounds: { left: number; right: number } }> }>;
    picker: { left: number; top: number; right: number; bottom: number; width: number; height: number; titleLeft: number; titleRight: number; titleLines: Array<{ left: number; right: number }>; frameHeight: number };
  };
  for (const bounds of previews) {
    expect(bounds.width, `${bounds.id} title width`).toBeGreaterThan(100);
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.viewport);
    expect(bounds.textNodes.length, `${bounds.id} long text`).toBeGreaterThan(0);
    for (const text of bounds.textNodes) {
      for (const line of text.rects) {
        expect(line.left).toBeGreaterThanOrEqual(text.bounds.left - 1);
        expect(line.right).toBeLessThanOrEqual(text.bounds.right + 1);
      }
    }
  }
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
  expect(bounds.titleLeft).toBeGreaterThanOrEqual(bounds.left);
  expect(bounds.titleRight).toBeLessThanOrEqual(bounds.right);
  expect(bounds.titleLines.length).toBeGreaterThan(1);
  expect(bounds.titleLines.every(({ left, right }) => left >= bounds.left && right <= bounds.right)).toBe(true);
  expect(bounds.frameHeight).toBeGreaterThanOrEqual(bounds.bottom);
}

test("Home Skeleton titles fit in the gallery across looks, modes and preview sizes", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  for (const device of ["desktop", "tablet"]) {
    await page.getByLabel("Screen size").selectOption(device);
    for (const look of ["default", "focused", "notebook"]) {
      await page.getByLabel("Look").selectOption(look);
      for (const mode of ["light", "dark"]) {
        await page.getByLabel("Mode").selectOption(mode);
        await expectHomeTitlesFit(page);
      }
    }
    for (const density of ["compact", "comfortable", "spacious"]) {
      await page.getByLabel("Density").selectOption(density);
      await expectHomeTitlesFit(page);
    }
    for (const textSize of ["1", "2", "3", "4", "5"]) {
      await page.getByLabel("Text size").selectOption(textSize);
      await expectHomeTitlesFit(page);
    }
  }
});

test("open picker gallery previews mount the controlled dialog and keep keyboard focus inside it", async ({ page }) => {
  await page.goto("/");
  const pickerFrame = page.locator('iframe[title="WidgetPicker · open"]');
  await pickerFrame.scrollIntoViewIfNeeded();
  const frame = pickerFrame.contentFrame();
  await page.waitForFunction(() => document.querySelector<HTMLIFrameElement>('iframe[title="WidgetPicker · open"]')?.contentDocument?.querySelector("#root")?.childElementCount);
  await expect.poll(() => page.evaluate(() => (document.activeElement as HTMLElement | null)?.tagName)).toBe("BODY");
  await expect(frame.getByRole("button", { name: "Customize" })).toBeVisible();
  await frame.getByRole("button", { name: "Customize" }).click();
  const dialog = frame.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const visibleHandle = await page.waitForFunction(() => {
    const iframe = Array.from(document.querySelectorAll("iframe")).find((item) => item.title === "WidgetPicker · open");
    const picker = iframe?.contentDocument?.querySelector("[data-widget-picker-dialog]");
    if (!iframe || !picker || picker.getBoundingClientRect().width === 0) return false;
    const rect = picker.getBoundingClientRect();
    if (Number(iframe.height) < rect.bottom) return false;
    const view = picker.ownerDocument.defaultView!;
    const title = picker.querySelector("[data-widget-picker-title]")!;
    const range = picker.ownerDocument.createRange();
    range.selectNodeContents(title);
    const titleLines = Array.from(range.getClientRects(), ({ left, right }) => ({ left, right }));
    const titleRect = title.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: view.innerWidth, height: view.innerHeight, titleLeft: titleRect.left, titleRight: titleRect.right, titleLines, frameHeight: Number(iframe.height) };
  });
  const visible = await visibleHandle.jsonValue() as {
    left: number; top: number; right: number; bottom: number; width: number; height: number;
    titleLeft: number; titleRight: number; titleLines: Array<{ left: number; right: number }>;
    frameHeight: number;
  };
  expect(visible.left).toBeGreaterThanOrEqual(0);
  expect(visible.top).toBeGreaterThanOrEqual(0);
  expect(visible.right).toBeLessThanOrEqual(visible.width);
  expect(visible.bottom).toBeLessThanOrEqual(visible.height);
  expect(visible.titleLeft).toBeGreaterThanOrEqual(visible.left);
  expect(visible.titleRight).toBeLessThanOrEqual(visible.right);
  expect(visible.titleLines.every(({ left, right }) => left >= visible.left && right <= visible.right)).toBe(true);
  expect(visible.frameHeight).toBeGreaterThanOrEqual(visible.bottom);
  const firstSwitch = frame.getByRole("switch").first();
  await firstSwitch.focus();
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => dialog.evaluate((element) => element.contains(element.ownerDocument.activeElement))).toBe(true);
  const lastAdd = frame.getByRole("button", { name: "Add Data table" });
  await lastAdd.focus();
  await page.keyboard.press("Tab");
  await expect.poll(() => dialog.evaluate((element) => element.contains(element.ownerDocument.activeElement))).toBe(true);
});

test("WidgetPicker fits short viewports and scrolls its rows", async ({ page }) => {
  for (const viewport of [{ width: 800, height: 500 }, { width: 844, height: 390 }, { width: 1024, height: 600 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/tests/browser/home-skeletons.html");
    await page.getByRole("button", { name: "Customize" }).click();
    const dialog = page.getByRole("dialog", { name: "Choose Home widgets" });
    await expect(dialog).toBeVisible();
    const geometry = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const title = element.querySelector("[data-slot=card-title]")!.getBoundingClientRect();
      const close = element.querySelector('[aria-label="Close widget picker"]')!.getBoundingClientRect();
      const scroll = element.querySelector('[data-slot="scroll-area-viewport"]')!;
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, height: rect.height, titleTop: title.top, titleCenter: title.top + title.height / 2, closeCenter: close.top + close.height / 2, scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight, scrollViewport: scroll.getBoundingClientRect().height, scrollStyle: getComputedStyle(scroll).height, card: element.querySelector('[data-slot="card"]')!.getBoundingClientRect().height };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(viewport.width);
    expect(geometry.bottom).toBeLessThanOrEqual(viewport.height);
    expect(geometry.titleTop).toBeGreaterThanOrEqual(geometry.top);
    expect(Math.abs(geometry.titleCenter - geometry.closeCenter)).toBeLessThanOrEqual(1);
    expect(geometry.scrollHeight, JSON.stringify(geometry)).toBeGreaterThan(geometry.clientHeight);
  }
});

test("long Switch and Add labels wrap inside the picker scroll viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/tests/browser/home-skeletons.html?long-picker-labels");
  await page.getByRole("button", { name: "Customize" }).click();
  const dialog = page.getByRole("dialog", { name: "Choose Home widgets" });
  const geometry = await dialog.evaluate((element) => {
    const viewport = element.querySelector('[data-slot="scroll-area-viewport"]')!;
    const viewportRect = viewport.getBoundingClientRect();
    const switchLabel = element.querySelector("label")!;
    const switchText = switchLabel.querySelector("span")!;
    const switchControl = switchLabel.querySelector("button[role=switch]")!;
    const add = element.querySelector('button[data-variant="outline"]')!;
    const textBounds = (target: Element) => {
      const range = element.ownerDocument.createRange();
      range.selectNodeContents(target);
      return Array.from(range.getClientRects(), ({ left, right }) => ({ left, right }));
    };
    const switchRect = switchControl.getBoundingClientRect();
    return {
      viewport: { left: viewportRect.left, right: viewportRect.right },
      switch: { left: switchRect.left, right: switchRect.right },
      switchLabel: textBounds(switchText),
      wordBreak: getComputedStyle(element.querySelectorAll("label")[1].querySelector("span")!).wordBreak,
      addLabel: textBounds(add),
      scrollWidth: viewport.scrollWidth,
      clientWidth: viewport.clientWidth,
    };
  });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.switch.left).toBeGreaterThanOrEqual(geometry.viewport.left);
  expect(geometry.switch.right).toBeLessThanOrEqual(geometry.viewport.right + 1);
  for (const line of [...geometry.switchLabel, ...geometry.addLabel]) {
    expect(line.left).toBeGreaterThanOrEqual(geometry.viewport.left - 1);
    expect(line.right).toBeLessThanOrEqual(geometry.viewport.right + 1);
  }
  expect(geometry.switchLabel.length).toBeGreaterThan(1);
  expect(geometry.wordBreak).toBe("normal");
  expect(geometry.addLabel.length, JSON.stringify(geometry)).toBeGreaterThan(1);
});

test("WidgetPicker caps a dialog with two widgets and thirty Add rows", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/tests/browser/home-skeletons.html?picker-height-cap");
  await page.getByRole("button", { name: "Customize" }).click();
  const dialog = page.getByRole("dialog", { name: "Choose Home widgets" });
  await expect(dialog.getByRole("switch")).toHaveCount(2);
  await expect(dialog.getByRole("button", { name: /^Add Data table/ })).toHaveCount(30);
  const bounds = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewport = element.ownerDocument.defaultView!;
    const scroll = element.querySelector('[data-slot="scroll-area-viewport"]')!;
    const close = element.querySelector('[aria-label="Close widget picker"]')!.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: rect.height, viewportHeight: viewport.innerHeight, scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight, closeTop: close.top, closeBottom: close.bottom };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight);
  expect(bounds.height).toBeLessThanOrEqual(390);
  expect(bounds.closeTop).toBeGreaterThanOrEqual(0);
  expect(bounds.closeBottom).toBeLessThanOrEqual(390);
});

test("Home titles and widget content wrap 150-character unbroken text", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/tests/browser/home-skeletons.html");
  const overflows = await page.locator("main").evaluate((main) => {
    const probes: Array<{ label: string; rects: DOMRect[]; bounds: DOMRect; parent: { tag: string; width: number; scrollWidth: number; wrap: string } }> = [];
    const walker = main.ownerDocument.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent !== "T".repeat(150) && node.textContent !== "a".repeat(150)) continue;
      const range = main.ownerDocument.createRange();
      range.selectNodeContents(node);
      const card = node.parentElement?.closest("[data-slot=card]");
      const parent = node.parentElement!;
      probes.push({ label: node.textContent[0], rects: Array.from(range.getClientRects()), bounds: (card ?? main.ownerDocument.documentElement).getBoundingClientRect(), parent: { tag: parent.tagName, width: parent.getBoundingClientRect().width, scrollWidth: parent.scrollWidth, wrap: getComputedStyle(parent).overflowWrap } });
    }
    return probes.map(({ label, rects, bounds, parent }) => ({ label, lineCount: rects.length, escaped: rects.some((rect) => rect.left < bounds.left - 1 || rect.right > bounds.right + 1), parent }));
  });
  expect(overflows.length).toBeGreaterThanOrEqual(12);
  expect(overflows.every(({ lineCount, escaped }) => lineCount > 1 && !escaped), JSON.stringify(overflows)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("375px Home layout wraps URLs, and the picker scrolls, fits and returns focus", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/tests/browser/home-skeletons.html");
  const headings = page.locator("main [role='region'] h2");
  await expect(headings).toHaveCount(7);
  for (const heading of await headings.all()) {
    const bounds = await heading.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, scrollWidth: element.scrollWidth, wordBreak: getComputedStyle(element).wordBreak };
    });
    expect(bounds.width).toBeGreaterThan(100);
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width);
    expect(bounds.wordBreak).not.toBe("break-all");
  }
  const homeHeader = page.locator("main [role='region']").first().locator('[data-slot="card-header"]');
  const headerGap = await homeHeader.evaluate((header) => header.getBoundingClientRect().bottom - header.querySelector('[data-slot="card-title"]')!.getBoundingClientRect().bottom);
  expect(headerGap).toBeLessThan(50);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  const trigger = page.getByRole("button", { name: "Customize" });
  const widgetFrame = page.getByRole("button", { name: /^Widget options for/ }).first();
  await widgetFrame.click();
  const dismiss = page.getByRole("menuitem", { name: "Dismiss" });
  await expect.poll(() => dismiss.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Escape");
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Choose Home widgets" });
  await expect(dialog).toBeVisible();
  const dimensions = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewport = element.ownerDocument.defaultView!;
    const scroll = element.querySelector('[data-slot="scroll-area-viewport"]')!;
    const close = element.querySelector('[aria-label="Close widget picker"]')!.getBoundingClientRect();
    return {
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      viewportWidth: viewport.innerWidth, viewportHeight: viewport.innerHeight,
      scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight,
      titleTop: element.querySelector("[data-slot=card-title]")!.getBoundingClientRect().top,
      titleBottom: element.querySelector("[data-slot=card-title]")!.getBoundingClientRect().bottom,
      closeTop: close.top, closeBottom: close.bottom,
      closeWidth: close.width, closeHeight: close.height,
    };
  });
  expect(dimensions.left).toBeGreaterThanOrEqual(0);
  expect(dimensions.top).toBeGreaterThanOrEqual(0);
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.viewportHeight);
  expect(dimensions.scrollHeight, JSON.stringify(dimensions)).toBeGreaterThan(dimensions.clientHeight);
  await expect.poll(() => page.getByRole("button", { name: "Close widget picker" }).evaluate((button) => button.getBoundingClientRect().width)).toBeGreaterThanOrEqual(44);
  await expect.poll(() => page.getByRole("button", { name: "Close widget picker" }).evaluate((button) => button.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);

  await page.getByRole("button", { name: "Close widget picker" }).click();
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
