import { expect, test } from "@playwright/test";

const panelStates = [
  ["DockedPanel", "open_docked", "panel_content"],
  ["DockedPanel", "open_undocked", "panel_content"],
  ["DockedPanel", "closed", "Open Workspace"],
  ["SourcesPanel", "docked", "Reference one"],
  ["SourcesPanel", "closed", "Sources (0)"],
  ["ProjectPanel", "decisions", "decision_one"],
  ["ProjectPanel", "constraints", "constraint_one"],
  ["ProjectPanel", "files", "file_one"],
] as const;

test("panel gallery states render with the selected settings across every configuration", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const titles = panelStates.map(([id, state]) => `${id} · ${state}`);
  const expectedContent = Object.fromEntries(panelStates.map(([id, state, content]) => [`${id} · ${state}`, content]));

  for (const [id, state, content] of panelStates) {
    const preview = page.frameLocator(`iframe[title="${id} · ${state}"]`);
    await expect(preview.getByText(content, { exact: false }).first()).toBeVisible();
  }

  const looks = ["default", "focused", "notebook"];
  const modes = ["light", "dark"];
  const densities = ["compact", "comfortable", "spacious"];
  const textSizes = ["1", "2", "3", "4", "5"];
  const devices = ["desktop", "tablet"];

  for (const look of looks) for (const mode of modes) for (const density of densities) for (const textSize of textSizes) for (const device of devices) {
    await page.getByLabel("Look").selectOption(look);
    await page.getByLabel("Mode").selectOption(mode);
    await page.getByLabel("Density").selectOption(density);
    await page.getByLabel("Text size").selectOption(textSize);
    await page.getByLabel("Screen size").selectOption(device);
    await expect(page.locator("[data-gallery-root]")).toHaveAttribute("data-look", look);
    const rootTokens = await page.locator("[data-gallery-root]").evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.getPropertyValue("--background").trim(), space: style.getPropertyValue("--space-1").trim(), text: style.getPropertyValue("--text-base").trim() };
    });
    const expectedWidth = device === "desktop" ? 1440 : 800;
    await expect.poll(() => page.locator("iframe").evaluateAll((frames, { expectedTitles: names, expectedContent: contentByTitle, tokens, expectedMode, width }) => {
      const previews = frames.map((frame) => {
      const iframe = frame as HTMLIFrameElement;
      const document = iframe.contentDocument;
      const view = document?.defaultView;
      const buttons = [...(document?.querySelectorAll("button") ?? [])].filter((button) => button.getClientRects().length > 0).map((button) => {
        const style = view!.getComputedStyle(button);
        const foreground = style.color.match(/[\d.]+/g)!.map(Number);
        const background = style.backgroundColor.match(/[\d.]+/g)!.map(Number);
        const luminance = ([r, g, b]: number[]) => [r, g, b].map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
        const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
        return { height: button.getBoundingClientRect().height, contrast: (light + 0.05) / (dark + 0.05) };
      });
      const heading = document?.querySelector("h2");
      const headingSize = heading && view ? view.getComputedStyle(heading).fontSize : undefined;
      const headingToken = document?.documentElement.style.getPropertyValue("--heading-3").trim();
      return {
        title: iframe.title,
        background: view?.getComputedStyle(document!.documentElement).getPropertyValue("--background").trim(),
        space: view?.getComputedStyle(document!.documentElement).getPropertyValue("--space-1").trim(),
        text: view?.getComputedStyle(document!.documentElement).getPropertyValue("--text-base").trim(),
        mode: document?.documentElement.dataset.mode,
        width: iframe.contentWindow?.innerWidth,
        content: document?.body.innerText.includes(contentByTitle[iframe.title]),
        healthy: !document?.body.innerText.includes("preview failed") && !document?.body.innerText.includes("Preview unavailable"),
        headingsMatchToken: !heading || headingSize === `${Number.parseFloat(headingToken ?? "") * 16}px`,
        controlsMeetTarget: buttons.every(({ height }) => height >= 44),
        controlsMeetContrast: buttons.every(({ contrast }) => contrast >= 4.5),
      };
      }).filter(({ title }) => names.includes(title));
      return previews.length === names.length && previews.every((preview) => preview.background === tokens.background && preview.space === tokens.space && preview.text === tokens.text && preview.mode === expectedMode && preview.width === width && preview.content && preview.healthy && preview.headingsMatchToken && preview.controlsMeetTarget && preview.controlsMeetContrast);
    }, {
      expectedTitles: titles,
      expectedContent,
      tokens: rootTokens,
      expectedMode: mode,
      width: expectedWidth,
    })).toBe(true);
  }

  const sources = page.frameLocator('iframe[title="SourcesPanel · docked"]');
  const list = sources.locator("ul");
  await expect(list).toHaveCSS("list-style-type", "disc");
  await expect(list.locator("li").first()).toHaveCSS("display", "list-item");
});

test("gallery previews complete panel callbacks, fit overlays, and preserve keyboard behavior", async ({ page }) => {
  await page.goto("/");

  const project = page.frameLocator('iframe[title="ProjectPanel · decisions"]');
  const decisions = project.getByText("decision_one", { exact: true });
  await expect(decisions).toBeVisible();
  const constraintsTab = project.getByRole("tab", { name: "constraints" });
  await constraintsTab.focus();
  await constraintsTab.press("ArrowDown");
  await constraintsTab.press("Enter");
  await expect(project.getByRole("tab", { name: "files" })).toHaveAttribute("aria-selected", "true");
  await expect(project.getByText("file_one", { exact: true })).toBeVisible();
  await expect(decisions).toBeHidden();

  const docked = page.frameLocator('iframe[title="DockedPanel · open_undocked"]');
  const dialog = docked.getByRole("dialog", { name: "Workspace" });
  await expect(dialog).toBeVisible();
  await expect(docked.getByText("panel_content", { exact: true })).toBeVisible();
  const geometry = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const height = window.innerHeight;
    const buttons = [...element.querySelectorAll("button")].map((button) => button.getBoundingClientRect());
    return { top: rect.top, bottom: rect.bottom, height, controlsSeparate: buttons[0]?.right <= buttons[1]?.left || buttons[1]?.right <= buttons[0]?.left || buttons[0]?.bottom <= buttons[1]?.top || buttons[1]?.bottom <= buttons[0]?.top };
  });
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);
  expect(geometry.controlsSeparate).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(docked.getByRole("button", { name: "Open Workspace" })).toBeFocused();

  const closed = page.frameLocator('iframe[title="DockedPanel · closed"]');
  await closed.getByRole("button", { name: "Open Workspace" }).click();
  await expect(closed.getByRole("separator", { name: "Resize workspace and panel" })).toBeVisible();
  const separator = closed.getByRole("separator", { name: "Resize workspace and panel" });
  const before = Number(await separator.getAttribute("aria-valuenow"));
  expect(Number.isFinite(before)).toBe(true);
  await separator.focus();
  await separator.press("ArrowLeft");
  await expect.poll(async () => Number(await separator.getAttribute("aria-valuenow"))).toBeLessThan(before);

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
