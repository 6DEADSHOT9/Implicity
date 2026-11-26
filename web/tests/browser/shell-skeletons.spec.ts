import { expect, test } from "@playwright/test";

const previews = [
  ["AppShell", "default"], ["AppShell", "docked"],
  ["ConversationNavigation", "populated"], ["ConversationNavigation", "empty"],
  ["Composer", "empty"], ["Composer", "with-attachments"],
  ["ChatHeader", "standard"], ["ChatHeader", "with-settings"],
  ["Search", "closed"], ["Search", "open"],
  ["Settings", "preferences"], ["Settings", "locks"], ["Settings", "notices"], ["Settings", "history"], ["Settings", "quota"],
] as const;

test("shell skeletons render usable, contained content across gallery settings", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const initialSearch = page.frameLocator("iframe[title='Search · open']");
  await expect(initialSearch.getByRole("dialog", { name: "Search" })).toBeVisible();
  const initialViewport = await page.evaluate(() => ({ scrollY, active: document.activeElement?.tagName, title: (document.activeElement as HTMLIFrameElement | null)?.title }));
  const searchFocus = await initialSearch.locator("body").evaluate((body) => ({ className: body.className, active: body.ownerDocument.activeElement?.outerHTML.slice(0, 160) }));
  expect(initialViewport.scrollY, JSON.stringify({ initialViewport, searchFocus })).toBe(0);
  expect(initialViewport.active).not.toBe("IFRAME");
  const root = page.locator("[data-gallery-root]");
  for (const device of ["desktop", "tablet"]) {
    await page.getByLabel("Screen size").selectOption(device);
    for (const look of ["default", "focused", "notebook"]) {
      await page.getByLabel("Look").selectOption(look);
      for (const mode of ["light", "dark"]) {
        await page.getByLabel("Mode").selectOption(mode);
        await expect(root).toHaveAttribute("data-device-class", device);
        await expect(root).toHaveAttribute("data-look", look);
        await expect(root).toHaveAttribute("data-mode", mode);
        const results = await Promise.all(previews.map(async ([id, state]) => {
          const frame = page.frameLocator(`iframe[title='${id} · ${state}']`);
          const selector = id === "AppShell" ? "main[data-slot=sidebar-inset]" : id === "ConversationNavigation" ? "nav[aria-label=Conversations]" : id === "Composer" ? "section[aria-label='Message composer']" : id === "ChatHeader" ? "h1" : id === "Search" ? (state === "open" ? "[role=dialog]" : "button") : "[role=dialog]";
          await frame.locator(selector).waitFor({ state: "visible" });
          return frame.locator("html").evaluate((element, { id, selector }) => {
            const rootElement = element.querySelector("#root");
            const dialog = element.querySelector<HTMLElement>("[role=dialog]");
            const bounds = dialog?.getBoundingClientRect();
            const content = element.querySelector<HTMLElement>(selector);
            const contentStyle = content && getComputedStyle(content);
            const rowsFit = [...(dialog?.querySelectorAll<HTMLElement>("[role=option]") ?? [])].every((row) => row.scrollWidth <= row.clientWidth);
            return {
              contained: element.scrollWidth <= element.clientWidth,
              rendered: !!rootElement?.childElementCount,
              alert: !!element.querySelector("[role=alert]"),
              contentVisible: !!content?.getClientRects().length && contentStyle?.visibility !== "hidden" && contentStyle?.opacity !== "0",
              dialogFits: !bounds || (bounds.left >= 0 && bounds.top >= 0 && bounds.right <= element.clientWidth && bounds.bottom <= element.clientHeight),
              dialogVisible: !dialog || !!(bounds?.width && bounds.height && getComputedStyle(dialog).visibility !== "hidden"),
              rowsFit,
            };
          }, { id, selector });
        }));
        expect(results.filter((result) => !result.contained || !result.rendered || result.alert || !result.contentVisible || !result.dialogFits || !result.dialogVisible || !result.rowsFit), `${device} ${look} ${mode}`).toEqual([]);
      }
    }
  }
  const search = page.frameLocator("iframe[title='Search · open']");
  await expect(search.getByRole("dialog", { name: "Search" })).toBeVisible();
  await expect(search.getByRole("button", { name: "Close search" })).toHaveJSProperty("offsetHeight", 44);
  expect(await search.getByRole("option").first().evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  const header = page.frameLocator("iframe[title='ChatHeader · with-settings']");
  expect(await header.getByRole("menuitem", { name: "Conversation settings" }).evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.getByLabel("Screen size").selectOption("desktop");
  const app = page.frameLocator("iframe[title='AppShell · docked']");
  await expect(app.locator("[data-slot=resizable-handle]")).toHaveJSProperty("offsetWidth", 44);
  const shell = await app.locator("[data-slot=sidebar]").evaluate((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, viewportHeight: window.innerHeight }));
  expect(shell.width).toBeGreaterThan(200);
  expect(shell.height).toBeGreaterThanOrEqual(shell.viewportHeight);
  const panels = app.locator("[data-slot=resizable-panel]");
  const measurePanels = () => panels.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  const initialWidths = await measurePanels();
  expect(initialWidths[0]).toBeGreaterThanOrEqual(320);
  expect(initialWidths[1]).toBeGreaterThanOrEqual(288);
  const handle = app.locator("[data-slot=resizable-handle]");
  await handle.evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }));
  await page.keyboard.press("End");
  const afterEnd = await measurePanels();
  expect(afterEnd[0]).toBeGreaterThanOrEqual(320);
  expect(afterEnd[1]).toBeGreaterThanOrEqual(288);
  await page.keyboard.press("Home");
  const afterHome = await measurePanels();
  expect(afterHome[0]).toBeGreaterThanOrEqual(320);
  expect(afterHome[1]).toBeGreaterThanOrEqual(288);
  expect(errors).toEqual([]);
});

test("shell skeletons fit a 375px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/");
  const galleryFrame = page.frameLocator("iframe[title='AppShell · default']");
  await expect(galleryFrame.locator("html")).toHaveAttribute("data-mode", "light");
  const styles = await galleryFrame.locator("html").evaluate((element) => element.style.cssText);
  for (const [entry, state] of [["Search", "open"], ["Settings", "preferences"], ["Composer", "empty"], ["AppShell", "docked"]]) {
    await page.goto(`/preview.html?entry=${entry}&state=${state}`);
    await page.evaluate((tokenStyles) => window.dispatchEvent(new MessageEvent("message", { data: { styles: tokenStyles, texture: "none", look: "default", mode: "light", density: "comfortable", textSize: "3", deviceClass: "desktop" }, origin: location.origin, source: window.parent })), styles);
    await expect(page.locator("html")).toHaveAttribute("data-mode", "light");
    await expect(page.locator("[role=alert]")).toHaveCount(0);
    if (entry === "Search" || entry === "Settings") await expect(page.getByRole("dialog")).toBeVisible();
    else if (entry === "Composer") await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
    else await expect(page.locator("main[data-slot=sidebar-inset]")).toBeVisible();
    if (entry === "Composer") {
      const shortcut = page.getByRole("button", { name: "Summarize" });
      await shortcut.evaluate((element) => { element.textContent = "unbroken".repeat(100); });
      const composer = page.getByRole("region", { name: "Message composer" });
      const overflow = await composer.evaluate((root) => [...root.querySelectorAll<HTMLElement>("textarea, button")].filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left < 0 || bounds.right > window.innerWidth || (element.scrollWidth > element.clientWidth && getComputedStyle(element).overflowX !== "hidden");
      }).map((element) => element.tagName));
      expect(overflow, "Composer descendants stay inside the 375px viewport with a long shortcut label").toEqual([]);
    }
    const dimensions = await page.locator("html").evaluate((element) => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
    expect(dimensions.scrollWidth, entry).toBeLessThanOrEqual(dimensions.width);
  }
});

test("AppShell stacks panes at tablet widths and keeps the shrinking pane usable", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto("/");
  await page.getByLabel("Screen size").selectOption("tablet");
  const app = page.frameLocator("iframe[title='AppShell · docked']");
  const handle = app.locator("[data-slot=resizable-handle]");
  await expect(handle).toHaveAttribute("aria-orientation", "horizontal");
  const group = app.locator("[data-slot=resizable-panel-group]");
  const panels = app.locator("[data-slot=resizable-panel]");
  const measure = () => panels.evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  }));
  expect((await measure()).every(({ width }) => width >= 288)).toBe(true);
  await handle.evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }));
  const groupHeight = await group.evaluate((element) => element.getBoundingClientRect().height) - (await handle.evaluate((element) => element.getBoundingClientRect().height));
  await page.keyboard.press("End");
  expect((await measure())[1].height).toBeGreaterThanOrEqual(groupHeight * 0.24);
  await page.keyboard.press("Home");
  expect((await measure())[0].height).toBeGreaterThanOrEqual(groupHeight * 0.52);
});

test("Search and Settings fit, filter, and return keyboard focus in a short viewport", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 375 });
  await page.goto("/");
  await page.evaluate(async () => {
    const fixtureUrl = "/tests/browser/shell-interactions-entry.tsx";
    await import(/* @vite-ignore */ fixtureUrl) as typeof import("./shell-interactions-entry");
    window.mountShellInteractions();
  });
  const dialog = page.getByRole("dialog", { name: "Search" });
  const input = page.getByRole("combobox", { name: "Search conversations" });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe("Search conversations");
  const dialogBounds = await dialog.boundingBox();
  expect(dialogBounds).not.toBeNull();
  expect(dialogBounds!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBounds!.y + dialogBounds!.height).toBeLessThanOrEqual(375);
  const closeBounds = await page.getByRole("button", { name: "Close search" }).boundingBox();
  expect(closeBounds).not.toBeNull();
  expect(closeBounds!.y).toBeGreaterThanOrEqual(0);
  const list = page.getByRole("listbox");
  expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await input.fill("no matching results");
  await expect(page.getByRole("option")).toHaveCount(0);
  await input.clear();
  await expect(page.getByRole("option")).toHaveCount(30);
  expect(await page.evaluate(() => window.shellSearchQueries.at(-1))).toBe("");
  await page.keyboard.press("Escape");
  const searchTrigger = page.getByRole("button", { name: "Search" });
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-slot"))).toBe("dialog-trigger");
  await searchTrigger.click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe("Search conversations");
  await page.keyboard.press("Escape");

  await page.waitForTimeout(3200);
  expect(await page.evaluate(() => window.shellInteractionEvents.filter((event) => event.name === "component_seen" && event.component === "Settings"))).toEqual([]);
  const settingsOpener = page.getByRole("button", { name: "Open app settings" });
  await settingsOpener.click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("Open app settings");
  await settingsOpener.click();
  await expect.poll(() => page.evaluate(() => window.shellInteractionEvents.some((event) => event.name === "component_seen" && event.component === "Settings" && event.default_state === "preferences"))).toBe(true);
});

test("native visibility reports the correct seen state for each shell", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const fixtureUrl = "/tests/browser/shell-seen-entry.tsx";
    await import(/* @vite-ignore */ fixtureUrl) as typeof import("./shell-seen-entry");
    window.mountShellSeen();
  });
  await expect.poll(() => page.evaluate(() => window.shellSeenEvents.filter((event) => event.name === "component_seen").length)).toBe(6);
  const states = await page.evaluate(() => window.shellSeenEvents.filter((event) => event.name === "component_seen").map(({ component, default_state }) => [component, default_state]).sort(([left], [right]) => left.localeCompare(right)));
  expect(states).toEqual([
    ["AppShell", "default"],
    ["ChatHeader", "standard"],
    ["Composer", "empty"],
    ["ConversationNavigation", "populated"],
    ["Search", "closed"],
    ["Settings", "preferences"],
  ]);
});
