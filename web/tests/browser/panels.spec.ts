import { expect, test, type Page } from "@playwright/test";

const panelStates = [
  ["DockedPanel", "open_docked", "panel_content"],
  ["DockedPanel", "open_undocked", "panel_content"],
  ["DockedPanel", "closed", "Open Workspace"],
  ["SourcesPanel", "docked", "Reference one"],
  ["SourcesPanel", "closed", "Sources (2)"],
  ["ProjectPanel", "decisions", "decision_one"],
  ["ProjectPanel", "constraints", "constraint_one"],
  ["ProjectPanel", "files", "file_one"],
] as const;

async function panelMatrix(page: Page, look: string, mode: string) {
  await page.goto("/");
  const titles = panelStates.map(([id, state]) => `${id} · ${state}`);
  const expectedContent = Object.fromEntries(panelStates.map(([id, state, content]) => [`${id} · ${state}`, content]));

  for (const [id, state, content] of panelStates) {
    const preview = page.frameLocator(`iframe[title="${id} · ${state}"]`);
    await expect(preview.getByText(content, { exact: false }).first()).toBeVisible();
  }

  const densities = ["compact", "comfortable", "spacious"];
  const textSizes = ["1", "2", "3", "4", "5"];
  const devices = ["desktop", "tablet"];
  const labels = { Look: "default", Mode: "light", Density: "comfortable", "Text size": "3", "Screen size": "desktop" };
  const setOption = async (label: keyof typeof labels, value: string) => {
    if (labels[label] === value) return;
    await page.getByLabel(label).selectOption(value);
    labels[label] = value;
  };

  for (const device of devices) for (const density of densities) for (const textSize of textSizes) {
    await setOption("Screen size", device);
    await setOption("Look", look);
    await setOption("Mode", mode);
    await setOption("Density", density);
    await setOption("Text size", textSize);
    await expect(page.locator("[data-gallery-root]")).toHaveAttribute("data-look", look);
    const rootTokens = await page.locator("[data-gallery-root]").evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.getPropertyValue("--background").trim(), space: style.getPropertyValue("--space-1").trim(), text: style.getPropertyValue("--text-base").trim(), target: style.getPropertyValue("--target-min-size").trim() };
    });
    const expectedWidth = device === "desktop" ? 1440 : 800;
    await expect.poll(() => page.locator("iframe").evaluateAll((frames, { expectedTitles: names, expectedContent: contentByTitle, tokens, expectedMode, width }) => {
      const previews = frames.filter((frame) => names.includes((frame as HTMLIFrameElement).title)).map((frame) => {
      const iframe = frame as HTMLIFrameElement;
      const document = iframe.contentDocument;
      const view = document?.defaultView;
      if (!document?.documentElement || !view) return { title: iframe.title, ready: false };
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
      const heading = document?.querySelector("h2");
      const headingSize = heading && view ? view.getComputedStyle(heading).fontSize : undefined;
      const headingToken = document?.documentElement.style.getPropertyValue("--heading-3").trim();
      const dialog = document.querySelector('[role="dialog"]');
      return {
        title: iframe.title,
        ready: true,
        background: view?.getComputedStyle(document!.documentElement).getPropertyValue("--background").trim(),
        space: view?.getComputedStyle(document!.documentElement).getPropertyValue("--space-1").trim(),
        text: view?.getComputedStyle(document!.documentElement).getPropertyValue("--text-base").trim(),
        target: view?.getComputedStyle(document!.documentElement).getPropertyValue("--target-min-size").trim(),
        mode: document?.documentElement.dataset.mode,
        width: iframe.contentWindow?.innerWidth,
        content: document?.body.innerText.includes(contentByTitle[iframe.title]),
        healthy: !document?.body.innerText.includes("preview failed") && !document?.body.innerText.includes("Preview unavailable"),
        headingsMatchToken: !heading || headingSize === `${Number.parseFloat(headingToken ?? "") * 16}px`,
        controlsMeetTarget: controls.length > 0 && controls.every(({ width: controlWidth, height }) => controlWidth >= target && height >= target),
        textMeetsContrast: texts.length > 0 && texts.every((contrastRatio) => contrastRatio >= 4.5),
        sheetSurfaceMatches: !dialog || view!.getComputedStyle(dialog).backgroundColor === view!.getComputedStyle(document!.body).backgroundColor,
      };
      });
      return previews.length === names.length && previews.every((preview) => preview.ready && preview.background === tokens.background && preview.space === tokens.space && preview.text === tokens.text && preview.target === tokens.target && preview.mode === expectedMode && preview.width === width && preview.content && preview.healthy && preview.headingsMatchToken && preview.controlsMeetTarget && preview.textMeetsContrast && preview.sheetSurfaceMatches) ? "ok" : JSON.stringify(previews.map(({ title, ready, background, space, text, target, mode, width: actualWidth, content, healthy, headingsMatchToken, controlsMeetTarget, textMeetsContrast, sheetSurfaceMatches }) => ({ title, ready, background, space, text, target, mode, width: actualWidth, content, healthy, headingsMatchToken, controlsMeetTarget, textMeetsContrast, sheetSurfaceMatches })));
    }, {
      expectedTitles: titles,
      expectedContent,
      tokens: rootTokens,
      expectedMode: mode,
      width: expectedWidth,
    }), { message: `panel invariant failed for ${JSON.stringify({ look, mode, density, textSize, device })}` }).toBe("ok");
  }

  const sources = page.frameLocator('iframe[title="SourcesPanel · docked"]');
  const list = sources.locator("ul");
  await expect(list).toHaveCSS("list-style-type", "disc");
  await expect(list.locator("li").first()).toHaveCSS("display", "list-item");
}

for (const look of ["default", "focused", "notebook"]) for (const mode of ["light", "dark"]) {
  test(`panel gallery matrix · ${look} · ${mode}`, async ({ page }) => panelMatrix(page, look, mode));
}

test("DockedPanel wraps and lets people select among 18 tabs on tablet", async ({ page }) => {
  const longLabel = "Release readiness and operational handover checklist for the production rollout, including service ownership, alert response and rollback notes";
  await page.goto("/");
  await page.getByLabel("Screen size").selectOption("tablet");
  const tabs = page.frameLocator('iframe[title="DockedPanel · open_undocked"]');
  const dialog = tabs.getByRole("dialog", { name: "Workspace" });
  await expect(dialog).toBeVisible();
  const sheetFrame = page.locator('iframe[title="DockedPanel · open_undocked"]');
  await sheetFrame.evaluate((frame, label) => {
    const tabTriggers = (frame as HTMLIFrameElement).contentDocument!.querySelectorAll<HTMLElement>("[role=tab]");
    tabTriggers[0].textContent = label;
    tabTriggers[1].textContent = "A";
  }, longLabel);
  await expect.poll(() => dialog.evaluate((element, label) => {
    const tabTriggers = [...element.querySelectorAll<HTMLElement>("[role=tab]")];
    const tabBoxes = tabTriggers.map((tab) => tab.getBoundingClientRect());
    const tabPanel = element.querySelector('[role="tabpanel"]:not([hidden])')!.getBoundingClientRect();
    const target = Number.parseFloat(getComputedStyle(element.ownerDocument.documentElement).getPropertyValue("--target-min-size")) * 16;
    return tabBoxes.length === 18 && tabBoxes.every(({ left, right, top, bottom, width, height }) => left >= 0 && right <= innerWidth && top >= 0 && bottom <= innerHeight && bottom <= tabPanel.top && width >= target && height >= target) && tabTriggers[0].textContent === label ? "ok" : JSON.stringify({ tabs: tabBoxes.map(({ left, right, top, bottom, width, height }) => ({ left, right, top, bottom, width, height })), panelTop: tabPanel.top, viewport: { width: innerWidth, height: innerHeight } });
  }, longLabel)).toBe("ok");
  await expect.poll(() => page.locator('iframe[title="DockedPanel · open_undocked"]').getAttribute("height").then(Number)).toBeGreaterThan(852);
  await page.locator('iframe[title="DockedPanel · open_undocked"]').scrollIntoViewIfNeeded();
  await expect(tabs.getByRole("tab", { name: longLabel })).toBeVisible();
  await tabs.getByRole("tab", { name: longLabel }).click({ timeout: 5000 });
  await expect(tabs.getByRole("tab", { name: longLabel })).toHaveAttribute("aria-selected", "true");
});

test("gallery previews complete panel callbacks, fit overlays, and preserve keyboard behavior", async ({ page }) => {
  await page.goto("/");

  const project = page.frameLocator('iframe[title="ProjectPanel · decisions"]');
  const decisions = project.getByText("decision_one", { exact: true });
  await expect(decisions).toBeVisible();
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

  const projectFrame = page.locator('iframe[title="ProjectPanel · decisions"]');
  for (const [device, width] of [["tablet", 800], ["desktop", 1440]] as const) {
    await page.getByLabel("Screen size").selectOption(device);
    await expect.poll(() => projectFrame.evaluate((frame) => (frame as HTMLIFrameElement).contentWindow?.innerWidth)).toBe(width);
    await expect(page.frameLocator('iframe[title="ProjectPanel · decisions"]').getByRole("tablist")).toBeVisible();
    await projectFrame.evaluate((frame) => {
      const item = (frame as HTMLIFrameElement).contentDocument!.querySelector('[role="listitem"]')!;
      item.textContent = "The team decided to keep the existing service and migrate in two carefully measured stages.";
    });
    await expect(page.frameLocator('iframe[title="ProjectPanel · decisions"]').getByText("The team decided to keep the existing service and migrate in two carefully measured stages.")).toBeVisible();
    const layout = await projectFrame.evaluate((frame) => {
      const document = (frame as HTMLIFrameElement).contentDocument!;
      return { tabs: document.querySelector('[role="tablist"]')!.getBoundingClientRect().width, content: document.querySelector('[role="tabpanel"]')!.getBoundingClientRect().width };
    });
    expect(layout.content).toBeGreaterThan(layout.tabs);
  }

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
});

test("SourcesPanel disclosure follows its controlled docked state", async ({ page }) => {
  await page.goto("/");
  const sources = page.frameLocator('iframe[title="SourcesPanel · docked"]');
  const trigger = sources.getByRole("button", { name: "Sources (2)" });
  await expect(sources.getByText("Reference one")).toBeVisible();
  await trigger.click();
  await expect(sources.getByRole("button", { name: "Sources (2)" })).toHaveAttribute("data-state", "closed");
  await expect(sources.getByText("Reference one")).toBeHidden();
  await trigger.click();
  await expect(sources.getByText("Reference one")).toBeVisible();
});
