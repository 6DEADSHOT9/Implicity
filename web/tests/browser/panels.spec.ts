import { expect, test } from "@playwright/test";

const panelStates = [
  ["DockedPanel", "open_docked"],
  ["DockedPanel", "open_undocked"],
  ["DockedPanel", "closed"],
  ["SourcesPanel", "populated"],
  ["SourcesPanel", "empty"],
  ["ProjectPanel", "decisions"],
  ["ProjectPanel", "constraints"],
  ["ProjectPanel", "files"],
] as const;

test("panel gallery states render across every look, mode, density, text size and device class", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  for (const [id, state] of panelStates) {
    const body = page.frameLocator(`iframe[title="${id} · ${state}"]`).locator("body");
    await expect(body).not.toContainText("preview failed");
    await expect(body).not.toContainText("Preview unavailable");
  }
  await expect(page.frameLocator('iframe[title="DockedPanel · open_undocked"]').getByRole("dialog", { name: "Workspace" })).toBeVisible();

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
    await expect(page.locator("[data-gallery-root]"))
      .toHaveAttribute("data-look", look);
    const background = await page.locator("[data-gallery-root]").evaluate((element) => getComputedStyle(element).getPropertyValue("--background").trim());
    const titles = panelStates.map(([id, state]) => `${id} · ${state}`);
    const expectedWidth = device === "desktop" ? 1440 : 800;
    await expect.poll(() => page.locator("iframe").evaluateAll((frames, expectedTitles) => frames.map((frame) => {
      const iframe = frame as HTMLIFrameElement;
      const document = iframe.contentDocument;
      return {
        title: iframe.title,
        background: document?.defaultView?.getComputedStyle(document.documentElement).getPropertyValue("--background").trim(),
        width: iframe.contentWindow?.innerWidth,
        failed: document?.body.innerText.includes("preview failed") || document?.body.innerText.includes("Preview unavailable"),
      };
    }).filter(({ title }) => expectedTitles.includes(title)).sort(({ title: a }, { title: b }) => a.localeCompare(b)), titles))
      .toEqual(titles.slice().sort().map((title) => ({ title, background, width: expectedWidth, failed: false })));
  }
});

test("Sources disclosure and DockedPanel Sheet remain operable in their previews", async ({ page }) => {
  await page.goto("/");
  const sources = page.frameLocator('iframe[title="SourcesPanel · populated"]');
  const trigger = sources.getByRole("button", { name: "Sources (2)" });
  await expect(sources.getByText("Reference one")).toBeVisible();
  await trigger.click();
  await expect(sources.getByText("Reference one")).toBeHidden();
  await trigger.click();
  await expect(sources.getByText("Reference one")).toBeVisible();

  const docked = page.frameLocator('iframe[title="DockedPanel · open_undocked"]');
  await expect(docked.getByRole("dialog", { name: "Workspace" })).toBeVisible();
  await expect(docked.getByRole("tab", { name: "Details" })).toBeVisible();

  const dockedPanel = page.frameLocator('iframe[title="DockedPanel · open_docked"]');
  const separator = dockedPanel.getByRole("separator");
  const before = await separator.getAttribute("aria-valuenow");
  await separator.focus();
  await separator.press("ArrowRight");
  await expect.poll(() => separator.getAttribute("aria-valuenow")).not.toBe(before);
});
