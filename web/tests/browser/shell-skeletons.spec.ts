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
  const app = page.frameLocator("iframe[title='AppShell · docked']");
  await expect(app.locator("[data-slot=resizable-handle]")).toHaveJSProperty("offsetWidth", 44);
  const shell = await app.locator("[data-slot=sidebar]").evaluate((element) => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, viewportHeight: window.innerHeight }));
  expect(shell.width).toBeGreaterThan(200);
  expect(shell.height).toBeGreaterThanOrEqual(shell.viewportHeight);
  const panelGroup = app.locator("[data-slot=resizable-panel-group]");
  const panels = app.locator("[data-slot=resizable-panel]");
  const groupWidth = await panelGroup.evaluate((element) => element.getBoundingClientRect().width);
  const measurePanels = () => panels.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  const initialWidths = await measurePanels();
  expect(initialWidths[0]).toBeGreaterThan(groupWidth * 0.5);
  expect(initialWidths[1]).toBeGreaterThan(groupWidth * 0.2);
  const handle = app.locator("[data-slot=resizable-handle]");
  await handle.evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }));
  await page.keyboard.press("End");
  expect((await measurePanels())[0]).toBeGreaterThanOrEqual(groupWidth * 0.51);
  await page.keyboard.press("Home");
  expect((await measurePanels())[1]).toBeGreaterThanOrEqual(groupWidth * 0.23);
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
    const dimensions = await page.locator("html").evaluate((element) => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
    expect(dimensions.scrollWidth, entry).toBeLessThanOrEqual(dimensions.width);
  }
});
