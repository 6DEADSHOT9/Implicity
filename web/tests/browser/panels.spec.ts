import { expect, test, type Page } from "@playwright/test";
import { builtPreviewUrl, selectGallerySettings } from "./gallery-test-helpers";

function openPanelGallery(page: Page, previews: readonly string[] = [], device: string = "desktop") {
  const search = new URLSearchParams({ ids: "DockedPanel,SourcesPanel,ProjectPanel" });
  if (device === "tablet") search.set("device", device);
  for (const title of previews) search.append("preview", title);
  return page.goto(builtPreviewUrl(`/tests/browser/focused-gallery.html?${search}`), { waitUntil: "domcontentloaded" });
}

const panelStates = [
  ["DockedPanel", "open_docked", "panel_content"],
  ["DockedPanel", "open_undocked", "panel_content"],
  ["DockedPanel", "stress", "panel_content"],
  ["DockedPanel", "closed", "Open Workspace"],
  ["SourcesPanel", "docked", "Reference one"],
  ["SourcesPanel", "closed", "Sources (2)"],
  ["ProjectPanel", "decisions", "decision_one"],
  ["ProjectPanel", "constraints", "constraint_one"],
  ["ProjectPanel", "files", "file_one"],
  ["ProjectPanel", "labels", "decision_one"],
] as const;

async function panelMatrix(page: Page, look: string, mode: string, device: string) {
  await openPanelGallery(page, [], device);
  const titles = panelStates.map(([id, state]) => `${id} · ${state}`);
  const expectedContent = Object.fromEntries(panelStates.map(([id, state, content]) => [`${id} · ${state}`, content]));

  await Promise.all(panelStates.map(async ([id, state, content]) => {
    const preview = page.frameLocator(`iframe[title="${id} · ${state}"]`);
    await expect(preview.getByText(content, { exact: false }).first()).toBeVisible({ timeout: 15000 });
  }));

  const densities = ["compact", "comfortable", "spacious"];
  const textSizes = ["1", "2", "3", "4", "5"];
  const result = await page.evaluate(async ({ names, contentByTitle, look, mode, width, densities, textSizes }) => {
    const root = document.querySelector<HTMLElement>("[data-gallery-root]")!;
    const selects = new Map([...root.querySelectorAll<HTMLSelectElement>("select[aria-label]")].map((select) => [select.getAttribute("aria-label"), select]));
    const frames = [...root.querySelectorAll<HTMLIFrameElement>("iframe")].filter(({ title }) => names.includes(title));

    function checkPreviews(expected: Record<string, string>) {
      if (Object.entries(expected).some(([key, value]) => root.dataset[key] !== value)) {
        return `gallery settings: ${JSON.stringify(root.dataset)}`;
      }
      const readTokens = (style: CSSStyleDeclaration) => ({
        background: style.getPropertyValue("--background").trim(),
        space: style.getPropertyValue("--space-1").trim(),
        text: style.getPropertyValue("--text-base").trim(),
        target: style.getPropertyValue("--target-min-size").trim(),
      });
      const tokens = readTokens(getComputedStyle(root));
      const previews = frames.map((iframe) => {
        const document = iframe.contentDocument;
        const view = document?.defaultView;
        if (!document?.documentElement || !view) return { title: iframe.title, ready: false as const };
        const frameSettings = document.documentElement.dataset;
        const viewport = { settings: { ...frameSettings }, width: view.innerWidth };
        if (viewport.width !== width || Object.entries(expected).some(([key, value]) => frameSettings[key] !== value)) {
          return { title: iframe.title, ready: false as const, ...viewport };
        }
        const frameTokens = readTokens(view.getComputedStyle(document.documentElement));
        const config = { ...frameTokens, ...viewport };
        if (frameTokens.background !== tokens.background || frameTokens.space !== tokens.space || frameTokens.text !== tokens.text || frameTokens.target !== tokens.target) {
          return { title: iframe.title, ready: false as const, ...config };
        }
        const rgba = (color: string) => color.slice(color.indexOf("(") + 1, color.lastIndexOf(")")).split(/[, /]+/).map(Number).concat(1).slice(0, 4).map((channel, index) => index === 3 ? channel : channel / 255);
        const contrast = (foreground: number[], background: number[]) => {
          const luminance = (color: number[]) => color.slice(0, 3).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
          const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
          return (light + 0.05) / (dark + 0.05);
        };
        const texts = [...document.querySelectorAll("*")].filter((element) => [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) && element.getClientRects().length > 0).map((element) => {
          const style = view!.getComputedStyle(element);
          let background = [0, 0, 0, 0];
          const ancestors: Element[] = [];
          for (let node: Element | null = element; node; node = node.parentElement) ancestors.unshift(node);
          for (const node of ancestors) {
            const layer = rgba(view!.getComputedStyle(node).backgroundColor);
            const alpha = layer[3];
            background = layer.slice(0, 3).map((channel, index) => channel * alpha + background[index] * (1 - alpha)).concat(alpha + background[3] * (1 - alpha));
          }
          if (background[3] < 1) background = background.slice(0, 3).map((channel) => channel * background[3] + 1 * (1 - background[3])).concat(1);
          const color = rgba(style.color);
          return contrast(color.slice(0, 3).map((channel, index) => channel * color[3] + background[index] * (1 - color[3])), background);
        });
        const target = Number.parseFloat(document.documentElement.style.getPropertyValue("--target-min-size")) * 16;
        const controls = [...document.querySelectorAll("button, [role=tab]")].filter((control) => control.getClientRects().length > 0).map((control) => control.getBoundingClientRect());
        const tabTriggers = [...document.querySelectorAll<HTMLElement>("[role=tab]")];
        const heading = document?.querySelector("h2");
        const headingSize = heading && view ? view.getComputedStyle(heading).fontSize : undefined;
        const headingToken = document?.documentElement.style.getPropertyValue("--heading-3").trim();
        const dialog = document.querySelector('[role="dialog"]');
        const panel = dialog ?? document.querySelector('section[aria-label="Project"]') ?? [...document.querySelectorAll<HTMLElement>('[data-slot="resizable-panel"]')].at(-1);
        return {
          title: iframe.title,
          ready: true as const,
          ...config,
          content: document?.body.innerText.includes(contentByTitle[iframe.title]),
          healthy: !document?.body.innerText.includes("preview failed") && !document?.body.innerText.includes("Preview unavailable"),
          headingsMatchToken: !heading || headingSize === `${Number.parseFloat(headingToken ?? "") * 16}px`,
          controlsMeetTarget: controls.length > 0 && controls.every(({ width: controlWidth, height }) => controlWidth >= target && height >= target),
          labelsAndPanelFit: (!iframe.title.startsWith("DockedPanel") || tabTriggers.every((tab) => tab.scrollWidth <= tab.clientWidth)) && (!panel || panel.scrollWidth <= panel.clientWidth),
          textMeetsContrast: texts.length > 0 && texts.every((contrastRatio) => contrastRatio >= 4.5),
          sheetSurfaceMatches: !dialog || view!.getComputedStyle(dialog).backgroundColor === view!.getComputedStyle(document!.body).backgroundColor,
        };
      });
      return previews.length === names.length && previews.every((preview) => preview.ready && preview.content && preview.healthy && preview.headingsMatchToken && preview.controlsMeetTarget && preview.labelsAndPanelFit && preview.textMeetsContrast && preview.sheetSurfaceMatches) ? "ok" : JSON.stringify(previews);
    }

    for (const density of densities) for (const textSize of textSizes) {
      for (const [label, value] of Object.entries({ Look: look, Mode: mode, Density: density, "Text size": textSize })) {
        const select = selects.get(label);
        if (!select || !Array.from(select.options).some((option) => option.value === value)) {
          throw new Error(`Gallery setting ${label} has no option ${value}`);
        }
        if (select.value === value) continue;
        select.value = value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const deadline = performance.now() + 5000;
      const expected = { look, mode, density, textSize };
      let status = checkPreviews(expected);
      while (status !== "ok" && performance.now() < deadline) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        status = checkPreviews(expected);
      }
      if (status !== "ok") return { ...expected, status };
    }
    return "ok";
  }, { names: titles, contentByTitle: expectedContent, look, mode, width: device === "desktop" ? 1440 : 800, densities, textSizes });
  expect(result, `panel invariant failed for ${look}/${mode}/${device}`).toBe("ok");

  const sources = page.frameLocator('iframe[title="SourcesPanel · docked"]');
  const list = sources.locator("ul");
  await expect(list).toHaveCSS("list-style-type", "disc");
  await expect(list.locator("li").first()).toHaveCSS("display", "list-item");
}

for (const look of ["default", "focused", "notebook"]) for (const mode of ["light", "dark"]) for (const device of ["desktop", "tablet"]) {
  test(`panel gallery matrix · ${look} · ${mode} · ${device}`, async ({ page }) => panelMatrix(page, look, mode, device));
}

test("DockedPanel wraps and lets people select among 18 tabs on tablet", async ({ page }) => {
  const longLabel = "Release readiness and operational handover checklist for the production rollout, including service ownership, alert response and rollback notes";
  const unbrokenLabel = "x".repeat(400);
  await openPanelGallery(page, ["DockedPanel · stress"]);
  await page.getByLabel("Screen size").selectOption("tablet", { timeout: 15000 });
  const tabs = page.frameLocator('iframe[title="DockedPanel · stress"]');
  const dialog = tabs.getByRole("dialog", { name: "Workspace" });
  await expect(dialog).toBeVisible({ timeout: 15000 });
  const sheetFrame = page.locator('iframe[title="DockedPanel · stress"]');
  await expect.poll(() => dialog.evaluate((element) => {
    const tabTriggers = [...element.querySelectorAll<HTMLElement>("[role=tab]")];
    const tabBoxes = tabTriggers.map((tab) => tab.getBoundingClientRect());
    const tabPanel = element.querySelector('[role="tabpanel"]:not([hidden])')!.getBoundingClientRect();
    const target = Number.parseFloat(getComputedStyle(element.ownerDocument.documentElement).getPropertyValue("--target-min-size")) * 16;
    return tabBoxes.length === 18 && tabBoxes.every(({ left, right, top, bottom, width, height }) => left >= 0 && right <= innerWidth && top >= 0 && bottom <= innerHeight && bottom <= tabPanel.top && width >= target && height >= target) && element.scrollWidth <= element.clientWidth && tabTriggers.every((tab) => tab.scrollWidth <= tab.clientWidth) ? "ok" : JSON.stringify({ tabs: tabTriggers.map((tab) => { const { left, right, top, bottom, width, height } = tab.getBoundingClientRect(); return { left, right, top, bottom, width, height, scrollWidth: tab.scrollWidth, clientWidth: tab.clientWidth }; }), sheet: { clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }, panelTop: tabPanel.top, viewport: { width: innerWidth, height: innerHeight } });
  })).toBe("ok");
  await expect(tabs.getByRole("tab", { name: longLabel })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: unbrokenLabel })).toBeVisible();
  await expect.poll(() => sheetFrame.getAttribute("height").then(Number)).toBeGreaterThan(852);
  await sheetFrame.scrollIntoViewIfNeeded();
  await expect(tabs.getByRole("tab", { name: longLabel })).toBeVisible();
  await tabs.getByRole("tab", { name: longLabel }).click({ timeout: 5000 });
  await expect(tabs.getByRole("tab", { name: longLabel })).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Text size").selectOption("5");
  await expect.poll(() => sheetFrame.getAttribute("height").then(Number)).toBeGreaterThan(852);
  await sheetFrame.evaluate((frame) => { (frame as HTMLIFrameElement).width = "375"; });
  await expect.poll(() => sheetFrame.evaluate((frame) => (frame as HTMLIFrameElement).contentWindow?.innerWidth)).toBe(375);
  await expect.poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth && [...element.querySelectorAll<HTMLElement>("[role=tab]")].every((tab) => tab.scrollWidth <= tab.clientWidth) ? "ok" : JSON.stringify({ sheet: [element.clientWidth, element.scrollWidth], tabs: [...element.querySelectorAll<HTMLElement>("[role=tab]")].map((tab) => [tab.clientWidth, tab.scrollWidth]) }))).toBe("ok");
});

async function assertGalleryPanelInteractions(page: Page, projectDevice: "tablet" | "desktop") {
  await openPanelGallery(page, ["ProjectPanel · decisions", "ProjectPanel · labels", "DockedPanel · open_undocked", "DockedPanel · closed", "DockedPanel · open_docked"]);

  const project = page.frameLocator('iframe[title="ProjectPanel · decisions"]');
  const longProjectLabel = "x".repeat(400);
  const longProjectTab = page.frameLocator('iframe[title="ProjectPanel · labels"]').getByRole("tab", { name: longProjectLabel });
  const projectFrame = page.locator('iframe[title="ProjectPanel · labels"]');
  const decisions = project.getByText("decision_one", { exact: true });
  await expect(decisions).toBeVisible({ timeout: 15000 });
  const decisionsTab = project.getByRole("tab", { name: "decisions" });
  await decisionsTab.focus();
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => project.getByRole("tab", { name: "constraints" }).evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(project.getByRole("tab", { name: "constraints" })).toHaveAttribute("aria-selected", "true");
  await expect(project.getByText("constraint_one", { exact: true })).toBeVisible();
  await expect(decisions).toBeHidden();
  const tabpanel = project.getByRole("tabpanel");
  await tabpanel.focus();
  expect(await tabpanel.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");

  if (projectDevice === "tablet") await page.getByLabel("Screen size").selectOption("tablet", { timeout: 15000 });
  const projectWidth = projectDevice === "tablet" ? 800 : 1440;
  await expect.poll(() => projectFrame.evaluate((frame) => (frame as HTMLIFrameElement).contentWindow?.innerWidth)).toBe(projectWidth);
  await expect(page.frameLocator('iframe[title="ProjectPanel · decisions"]').getByRole("tablist")).toBeVisible({ timeout: 15000 });
  await expect(longProjectTab).toBeVisible({ timeout: 15000 });
  const labelLayout = await projectFrame.evaluate((frame) => {
      const section = (frame as HTMLIFrameElement).contentDocument!.querySelector('section[aria-label="Project"]')!;
      const unbrokenTab = [...section.querySelectorAll<HTMLElement>("[role=tab]")].find((tab) => tab.textContent === "x".repeat(400))!;
      const range = section.ownerDocument.createRange();
      range.selectNodeContents(unbrokenTab);
      const rects = [...range.getClientRects()];
      const bounds = unbrokenTab.getBoundingClientRect();
      return { sectionWidth: section.clientWidth, sectionScrollWidth: section.scrollWidth, tablistWidth: section.querySelector('[role="tablist"]')!.clientWidth, panelWidth: section.querySelector('[role="tabpanel"]')!.clientWidth, unbrokenLines: rects.length, unbrokenTextFits: rects.every(({ left, right }) => left >= bounds.left && right <= bounds.right) };
  });
  expect(labelLayout.sectionScrollWidth).toBeLessThanOrEqual(labelLayout.sectionWidth);
  expect(labelLayout.unbrokenLines).toBeGreaterThan(1);
  expect(labelLayout.unbrokenTextFits).toBe(true);
  expect(labelLayout.tablistWidth).toBeLessThan(labelLayout.sectionWidth);
  expect(labelLayout.panelWidth).toBeGreaterThanOrEqual(labelLayout.sectionWidth * 0.44);
  await projectFrame.evaluate((frame) => {
      const item = (frame as HTMLIFrameElement).contentDocument!.querySelector('[role="listitem"]')!;
      item.textContent = "The team decided to keep the existing service and migrate in two carefully measured stages.";
  });
  await expect(page.frameLocator('iframe[title="ProjectPanel · labels"]').getByText("The team decided to keep the existing service and migrate in two carefully measured stages.")).toBeVisible();
  const layout = await projectFrame.evaluate((frame) => {
      const document = (frame as HTMLIFrameElement).contentDocument!;
      return { tabs: document.querySelector('[role="tablist"]')!.getBoundingClientRect().width, content: document.querySelector('[role="tabpanel"]')!.getBoundingClientRect().width };
  });
  expect(layout.content).toBeGreaterThan(layout.tabs);

  const docked = page.frameLocator('iframe[title="DockedPanel · open_undocked"]');
  const dialog = docked.getByRole("dialog", { name: "Workspace" });
  await expect(dialog).toBeVisible();
  await expect(docked.getByText("panel_content", { exact: true })).toBeVisible();
  await expect.poll(() => dialog.evaluate((element) => [...element.querySelectorAll("button, [role=tab], [role=tabpanel]")].filter((node) => {
    const box = node.getBoundingClientRect();
    return box.left < 0 || box.right > innerWidth || box.top < 0 || box.bottom > innerHeight;
  }).length)).toBe(0);
  const geometry = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const height = window.innerHeight;
    const nodes = [...element.querySelectorAll("button, [role=tab], [role=tabpanel]")];
    const buttons = [...element.querySelectorAll("button")].map((button) => button.getBoundingClientRect());
    return { top: rect.top, bottom: rect.bottom, height, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, outside: nodes.flatMap((node) => { const box = node.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight ? [] : [{ element: node.getAttribute("aria-label") ?? node.getAttribute("role"), text: node.textContent, left: box.left, right: box.right, top: box.top, bottom: box.bottom }]; }), controlsSeparate: buttons[0]?.right <= buttons[1]?.left || buttons[1]?.right <= buttons[0]?.left || buttons[0]?.bottom <= buttons[1]?.top || buttons[1]?.bottom <= buttons[0]?.top };
  });
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.outside).toEqual([]);
  expect(geometry.controlsSeparate).toBe(true);
  await docked.getByRole("button", { name: "Close" }).press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(docked.getByRole("button", { name: "Open Workspace" })).toBeFocused();

  const sheetFrame = page.locator('iframe[title="DockedPanel · open_undocked"]');
  const sheetRoot = sheetFrame.contentFrame().locator("html");
  await docked.getByRole("button", { name: "Open Workspace" }).click();
  await expect(docked.getByRole("dialog", { name: "Workspace" })).toBeVisible();
  await sheetFrame.evaluate((frame) => {
    (frame as HTMLIFrameElement).contentDocument!.querySelector('[role="tabpanel"]')!.textContent = "A detailed project history entry that wraps across several lines as its text size changes. ".repeat(8);
  });
  const initialSheetHeight = Number(await sheetFrame.getAttribute("height"));
  await page.getByLabel("Text size").selectOption("5");
  await expect(sheetRoot).toHaveAttribute("data-text-size", "5");
  await expect.poll(() => sheetFrame.getAttribute("height").then(Number)).toBeGreaterThan(initialSheetHeight);
  const largeSheetHeight = Number(await sheetFrame.getAttribute("height"));
  await page.getByLabel("Text size").selectOption("1");
  await expect(sheetRoot).toHaveAttribute("data-text-size", "1");
  await expect.poll(() => sheetFrame.getAttribute("height").then(Number)).toBeLessThan(largeSheetHeight);

  const closed = page.frameLocator('iframe[title="DockedPanel · closed"]');
  await closed.getByRole("button", { name: "Open Workspace" }).click();
  await expect(closed.getByRole("button", { name: "Close" })).toBeFocused();
  await expect(closed.getByRole("separator", { name: "Resize workspace and panel" })).toBeVisible();
  const separator = closed.getByRole("separator", { name: "Resize workspace and panel" });
  const before = Number(await separator.getAttribute("aria-valuenow"));
  expect(Number.isFinite(before)).toBe(true);
  await separator.focus();
  await separator.press("ArrowLeft");
  expect(await separator.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
  await expect.poll(async () => Number(await separator.getAttribute("aria-valuenow"))).toBeLessThan(before);
  await closed.getByRole("button", { name: "Close" }).click();
  await expect(closed.getByRole("button", { name: "Open Workspace" })).toBeFocused();
  await closed.getByRole("button", { name: "Open Workspace" }).click();
  await closed.getByRole("button", { name: "Undock" }).click();
  await expect(closed.getByRole("button", { name: "Dock" })).toBeFocused();
  await closed.getByRole("button", { name: "Dock" }).click();
  await expect(closed.getByRole("button", { name: "Undock" })).toBeFocused();
  for (let index = 0; index < 14; index += 1) await separator.press("ArrowRight");
  const minimumPanelWidth = await closed.locator('[data-slot="resizable-panel"]').nth(1).evaluate((element) => {
    const root = element.ownerDocument.documentElement;
    return { width: element.getBoundingClientRect().width, token: Number.parseFloat(getComputedStyle(root).getPropertyValue("--panel-min-width")) * 16 };
  });
  expect(minimumPanelWidth.width).toBeGreaterThanOrEqual(minimumPanelWidth.token);

  const smallScreen = page.locator('iframe[title="DockedPanel · open_docked"]');
  await smallScreen.evaluate((frame) => { (frame as HTMLIFrameElement).width = "767"; });
  const smallPreview = page.frameLocator('iframe[title="DockedPanel · open_docked"]');
  await expect(smallPreview.getByRole("dialog", { name: "Workspace" })).toBeVisible();
  await smallScreen.evaluate((frame) => { (frame as HTMLIFrameElement).width = "768"; });
  await expect(smallPreview.getByRole("dialog", { name: "Workspace" })).toHaveCount(0);
}

for (const device of ["tablet", "desktop"] as const) test(`gallery panel interactions fit at ${device} width`, async ({ page }) => assertGalleryPanelInteractions(page, device));

async function assertProjectLabels(page: Page, width: 375 | 288) {
  await openPanelGallery(page, ["ProjectPanel · decisions"]);
  const frame = page.locator('iframe[title="ProjectPanel · decisions"]');
  await expect(frame.contentFrame().locator('section[aria-label="Project"]')).toBeVisible({ timeout: 15000 });
  for (const density of ["compact", "comfortable", "spacious"]) for (const textSize of ["1", "2", "3", "4", "5"]) {
    await selectGallerySettings(page, { Density: density, "Text size": textSize }, 15000);
    await frame.evaluate((element, value) => { (element as HTMLIFrameElement).width = String(value); }, width);
    await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentWindow?.innerWidth), { timeout: 10000 }).toBe(width);
    await expect.poll(() => frame.evaluate((element) => {
      const document = (element as HTMLIFrameElement).contentDocument!;
      const section = document.querySelector('section[aria-label="Project"]')!;
      const list = section.querySelector<HTMLElement>('[role="tablist"]')!;
      const labels = [...list.querySelectorAll<HTMLElement>("[role=tab]")].map((tab) => {
        const range = document.createRange();
        range.selectNodeContents(tab);
        return { label: tab.textContent, lines: range.getClientRects().length };
      });
      return section.scrollWidth <= section.clientWidth && list.scrollWidth <= list.clientWidth && labels.every(({ lines }) => lines === 1) ? "ok" : JSON.stringify({ width: section.clientWidth, scroll: section.scrollWidth, listWidth: list.clientWidth, listScroll: list.scrollWidth, labels });
    }), { timeout: 10000 }).toBe("ok");
  }
}

for (const width of [375, 288] as const) test(`ProjectPanel keeps its short labels on one line at ${width}px`, async ({ page }) => assertProjectLabels(page, width));

async function assertFocusedProjectLabels(page: Page, viewportWidth: 288 | 1440, panelWidth?: 288 | 375) {
  await openPanelGallery(page, ["ProjectPanel · decisions"]);
  const frame = page.locator('iframe[title="ProjectPanel · decisions"]');
  const section = frame.contentFrame().locator('section[aria-label="Project"]');
  await expect(section).toBeVisible({ timeout: 15000 });
  if (viewportWidth === 288) {
    await page.getByLabel("Screen size").selectOption("tablet");
    await expect(section).toBeVisible({ timeout: 15000 });
    await frame.evaluate((element) => { (element as HTMLIFrameElement).width = "288"; });
    await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentWindow?.innerWidth)).toBe(288);
  }
  await page.getByLabel("Look").selectOption("focused");
  await page.getByLabel("Density").selectOption("spacious");
  if (viewportWidth === 1440 && panelWidth) {
    await frame.evaluate((element, width) => {
      const document = (element as HTMLIFrameElement).contentDocument!;
      document.querySelector<HTMLElement>('section[aria-label="Project"]')!.parentElement!.style.width = `${width}px`;
    }, panelWidth);
    await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentWindow?.innerWidth), { timeout: 15000 }).toBe(1440);
  }
  const previewHtml = frame.contentFrame().locator("html");
  await expect(previewHtml).toHaveAttribute("data-look", "focused");
  await expect(previewHtml).toHaveAttribute("data-density", "spacious");
  for (const textSize of ["1", "2", "3", "4", "5"]) {
    await page.getByLabel("Text size").selectOption(textSize);
    await expect(previewHtml).toHaveAttribute("data-text-size", textSize);
    await frame.evaluate(async (element) => { await (element as HTMLIFrameElement).contentDocument!.fonts.ready; });
    await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentDocument?.fonts.status)).toBe("loaded");
    await expect.poll(() => frame.evaluate((element) => {
      const document = (element as HTMLIFrameElement).contentDocument!;
      const section = document.querySelector<HTMLElement>('section[aria-label="Project"]')!;
      const list = section.querySelector<HTMLElement>('[role="tablist"]')!;
      const labels = [...list.querySelectorAll<HTMLElement>("[role=tab]")].map((tab) => {
        const range = document.createRange();
        range.selectNodeContents(tab);
        return { label: tab.textContent, lines: range.getClientRects().length };
      });
      return section.scrollWidth <= section.clientWidth && list.scrollWidth <= list.clientWidth && labels.every(({ lines }) => lines === 1) ? "ok" : JSON.stringify({ viewport: document.defaultView?.innerWidth, width: section.clientWidth, scroll: section.scrollWidth, listWidth: list.clientWidth, listScroll: list.scrollWidth, labels });
    })).toBe("ok");
  }
}

test("ProjectPanel short labels fit Focused at a 288px viewport", async ({ page }) => assertFocusedProjectLabels(page, 288));
test("ProjectPanel short labels fit a 288px panel in a 1440px viewport", async ({ page }) => assertFocusedProjectLabels(page, 1440, 288));
test("ProjectPanel short labels fit a 375px panel in a 1440px viewport", async ({ page }) => assertFocusedProjectLabels(page, 1440, 375));

test("ProjectPanel keeps content readable beside a long tab label", async ({ page }) => {
  await openPanelGallery(page, ["ProjectPanel · labels"]);
  const frame = page.locator('iframe[title="ProjectPanel · labels"]');
  const section = frame.contentFrame().locator('section[aria-label="Project"]');
  await expect(section).toBeVisible({ timeout: 15000 });
  await expect(frame.contentFrame().locator("html")).toHaveAttribute("data-look", "default");
  await expect(frame.contentFrame().locator("html")).toHaveAttribute("data-density", "comfortable");
  await expect(frame.contentFrame().locator("html")).toHaveAttribute("data-text-size", "3");
  await frame.evaluate(async (element) => { await (element as HTMLIFrameElement).contentDocument!.fonts.ready; });
  await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentDocument?.fonts.status), { timeout: 15000 }).toBe("loaded");

  for (const width of [288, 384]) {
    await frame.evaluate((element, value) => {
      const document = (element as HTMLIFrameElement).contentDocument!;
      document.querySelector<HTMLElement>('section[aria-label="Project"]')!.parentElement!.style.width = `${value}px`;
    }, width);
    await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentWindow?.innerWidth), { timeout: 15000 }).toBe(1440);
    await expect(frame.contentFrame().getByRole("tablist")).toHaveAttribute("aria-orientation", width === 288 ? "horizontal" : "vertical");
    const contentWidth = await frame.evaluate((element) => {
      const panel = (element as HTMLIFrameElement).contentDocument!.querySelector<HTMLElement>('section[aria-label="Project"]')!;
      return panel.querySelector<HTMLElement>("[role=tabpanel]")!.getBoundingClientRect().width;
    });
    expect(contentWidth, `content width at ${width}px`).toBeGreaterThanOrEqual(width === 288 ? 100 : 180);
  }
});

test("ProjectPanel stacks tabs above content at 288px for short and long labels", async ({ page }) => {
  await openPanelGallery(page, ["ProjectPanel · decisions", "ProjectPanel · labels"]);
  for (const state of ["decisions", "labels"] as const) {
    const frame = page.locator(`iframe[title="ProjectPanel · ${state}"]`);
    await expect(frame.contentFrame().getByRole("tablist")).toBeVisible({ timeout: 15000 });
    await frame.evaluate((element) => {
      const document = (element as HTMLIFrameElement).contentDocument!;
      document.querySelector<HTMLElement>('section[aria-label="Project"]')!.parentElement!.style.width = "288px";
    });
    await expect(frame.contentFrame().getByRole("tablist")).toHaveAttribute("aria-orientation", "horizontal");
    const geometry = await frame.evaluate((element) => {
      const document = (element as HTMLIFrameElement).contentDocument!;
      const list = document.querySelector<HTMLElement>('[role="tablist"]')!;
      const content = document.querySelector<HTMLElement>("[role=tabpanel]")!;
      const listBottom = list.getBoundingClientRect().bottom;
      const contentTop = content.getBoundingClientRect().top;
      return [...list.querySelectorAll<HTMLElement>("[role=tab]")].map((tab) => ({
        label: tab.textContent,
        bottom: tab.getBoundingClientRect().bottom,
        listBottom,
        contentTop,
      }));
    });
    expect(geometry.length, state).toBeGreaterThan(0);
    for (const tab of geometry) {
      expect(tab.bottom, `${state} tab ${tab.label} inside tab list`).toBeLessThanOrEqual(tab.listBottom);
      expect(tab.bottom, `${state} tab ${tab.label} above content`).toBeLessThanOrEqual(tab.contentTop);
    }
  }
});

test("ProjectPanel switches at its own width in a 1440px viewport", async ({ page }) => {
  await openPanelGallery(page, ["ProjectPanel · decisions"]);
  const frame = page.locator('iframe[title="ProjectPanel · decisions"]');
  await expect(frame.contentFrame().getByRole("tablist")).toBeVisible({ timeout: 15000 });
  for (const [width, orientation] of [[383, "horizontal"], [384, "vertical"]] as const) {
    await frame.evaluate((element, value) => {
      const document = (element as HTMLIFrameElement).contentDocument!;
      document.querySelector<HTMLElement>('section[aria-label="Project"]')!.parentElement!.style.width = `${value}px`;
    }, width);
    await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentWindow?.innerWidth), { timeout: 15000 }).toBe(1440);
    await expect(frame.contentFrame().getByRole("tablist")).toHaveAttribute("aria-orientation", orientation);
  }
});

test("ProjectPanel fills a flex-row parent", async ({ page }) => {
  await openPanelGallery(page, ["ProjectPanel · decisions"]);
  const frame = page.locator('iframe[title="ProjectPanel · decisions"]');
  await expect(frame.contentFrame().getByRole("tablist")).toBeVisible({ timeout: 15000 });
  const width = await frame.evaluate((element) => {
    const document = (element as HTMLIFrameElement).contentDocument!;
    const root = document.querySelector<HTMLElement>("#root")!;
    root.style.display = "flex";
    root.style.flexDirection = "row";
    root.style.width = "100%";
    return document.querySelector<HTMLElement>('section[aria-label="Project"]')!.parentElement!.getBoundingClientRect().width;
  });
  expect(width).toBeGreaterThan(1000);
});

test("ProjectPanel keeps Constraints whole in Focused spacious at every size", async ({ page }) => {
  await openPanelGallery(page, ["ProjectPanel · decisions"]);
  const frame = page.locator('iframe[title="ProjectPanel · decisions"]');
  await expect(frame.contentFrame().getByRole("tablist")).toBeVisible({ timeout: 15000 });
  await page.getByLabel("Look").selectOption("focused");
  await page.getByLabel("Density").selectOption("spacious");
  await frame.evaluate((element) => { (element as HTMLIFrameElement).width = "384"; });
  for (const textSize of ["1", "2", "3", "4", "5"]) {
    await page.getByLabel("Text size").selectOption(textSize);
    await expect(frame.contentFrame().locator("html")).toHaveAttribute("data-text-size", textSize);
    await frame.evaluate(async (element) => { await (element as HTMLIFrameElement).contentDocument!.fonts.ready; });
    const constraintLines = await frame.evaluate((element) => {
      const document = (element as HTMLIFrameElement).contentDocument!;
      const tab = [...document.querySelectorAll<HTMLElement>("[role=tab]")].find((candidate) => candidate.textContent === "Constraints")!;
      const range = document.createRange();
      range.selectNodeContents(tab);
      return range.getClientRects().length;
    });
    expect(constraintLines, `Constraints at text size ${textSize}`).toBe(1);
  }
});

for (const look of ["default", "focused", "notebook"] as const) for (const width of [288, 384] as const) test(`ProjectPanel uses its ${width}px container in ${look} across density and text sizes`, async ({ page }) => {
  await openPanelGallery(page, ["ProjectPanel · decisions", "ProjectPanel · labels"]);
  const decisions = page.locator('iframe[title="ProjectPanel · decisions"]');
  const longLabel = page.locator('iframe[title="ProjectPanel · labels"]');
  await Promise.all([decisions, longLabel].map((frame) => expect(frame.contentFrame().getByRole("tablist")).toBeVisible({ timeout: 15000 })));
  await Promise.all([decisions, longLabel].map((frame) => frame.evaluate((element, value) => { (element as HTMLIFrameElement).width = String(value); }, width)));
  await page.getByLabel("Look").selectOption(look);

  for (const density of ["compact", "comfortable", "spacious"] as const) for (const textSize of ["1", "2", "3", "4", "5"] as const) {
    await selectGallerySettings(page, { Density: density, "Text size": textSize });
    await expect.poll(() => page.evaluate(({ width: expectedWidth, look: expectedLook, density: expectedDensity, textSize: expectedTextSize }) => [...document.querySelectorAll<HTMLIFrameElement>('iframe[title="ProjectPanel · decisions"], iframe[title="ProjectPanel · labels"]')].length === 2 && [...document.querySelectorAll<HTMLIFrameElement>('iframe[title="ProjectPanel · decisions"], iframe[title="ProjectPanel · labels"]')].every((frame) => {
      const preview = frame.contentDocument;
      return frame.contentWindow?.innerWidth === expectedWidth && preview?.documentElement.dataset.look === expectedLook && preview.documentElement.dataset.density === expectedDensity && preview.documentElement.dataset.textSize === expectedTextSize;
    }), { width, look, density, textSize }), { timeout: 15000 }).toBe(true);
    await page.evaluate(async () => Promise.all([...document.querySelectorAll<HTMLIFrameElement>('iframe[title="ProjectPanel · decisions"], iframe[title="ProjectPanel · labels"]')].map((frame) => frame.contentDocument!.fonts.ready)));

    const layout = await decisions.evaluate((element) => {
      const document = (element as HTMLIFrameElement).contentDocument!;
      const panel = document.querySelector<HTMLElement>('section[aria-label="Project"]')!;
      const list = panel.querySelector<HTMLElement>("[role=tablist]")!;
      const constraints = [...list.querySelectorAll<HTMLElement>("[role=tab]")].find((tab) => tab.textContent === "Constraints")!;
      const range = document.createRange();
      range.selectNodeContents(constraints);
      return { orientation: list.getAttribute("aria-orientation"), constraintLines: range.getClientRects().length, overflow: panel.scrollWidth > panel.clientWidth || list.scrollWidth > list.clientWidth };
    });
    expect(layout.orientation).toBe(width === 288 ? "horizontal" : "vertical");
    expect(layout.constraintLines, `Constraints at ${look}/${density}/${textSize}/${width}`).toBe(1);
    expect(layout.overflow, `horizontal overflow at ${look}/${density}/${textSize}/${width}`).toBe(false);

    const contentWidth = await longLabel.evaluate((element) => {
      const panel = (element as HTMLIFrameElement).contentDocument!.querySelector<HTMLElement>('section[aria-label="Project"]')!;
      return panel.querySelector<HTMLElement>("[role=tabpanel]")!.getBoundingClientRect().width;
    });
    expect(contentWidth, `long-label content at ${look}/${density}/${textSize}/${width}`).toBeGreaterThanOrEqual(100);
  }
});

test("SourcesPanel disclosure follows its controlled docked state", async ({ page }) => {
  await openPanelGallery(page, ["SourcesPanel · docked"]);
  const sources = page.frameLocator('iframe[title="SourcesPanel · docked"]');
  const trigger = sources.getByRole("button", { name: "Sources (2)" });
  await expect(sources.getByText("Reference one")).toBeVisible({ timeout: 15000 });
  await trigger.press("Enter");
  await expect(sources.getByRole("button", { name: "Sources (2)" })).toHaveAttribute("data-state", "closed");
  await expect(sources.getByText("Reference one")).toBeHidden();
  await trigger.press("Enter");
  await expect(sources.getByText("Reference one")).toBeVisible();
});
