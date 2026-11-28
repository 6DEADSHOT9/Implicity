import { expect, test, type Locator } from "@playwright/test";
import { SEEN_VISIBLE_SECONDS } from "../../src/registry/use-seen";

const shellGallery = "/tests/browser/shell-gallery.html";
const galleryOf = (...shells: string[]) => `${shellGallery}?only=${shells.join(",")}`;

const previews = [
  ["AppShell", "default"], ["AppShell", "docked"],
  ["ConversationNavigation", "populated"], ["ConversationNavigation", "empty"],
  ["Composer", "empty"], ["Composer", "with-attachments"],
  ["ChatHeader", "standard"], ["ChatHeader", "with-settings"],
  ["Search", "closed"], ["Search", "open"],
  ["Settings", "preferences"], ["Settings", "locks"], ["Settings", "notices"], ["Settings", "history"], ["Settings", "quota"],
] as const;

// The library applies new pixel minima after a resize notification; until then Home and End use the old percentages.
const expectCurrentLimits = (handle: Locator, message: string) => expect.poll(() => handle.evaluate((separator) => {
  const group = separator.parentElement!;
  const [mainPadding, panelPadding] = [...group.querySelectorAll<HTMLElement>("[data-slot=resizable-panel] [class*='p-space-']")].map((slot) => {
    const style = getComputedStyle(slot);
    return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  });
  const area = group.getBoundingClientRect().width - separator.getBoundingClientRect().width;
  const off = (attribute: string, percent: number) => Math.abs(Number(separator.getAttribute(attribute)) - percent) > 0.01;
  return [
    off("aria-valuemin", (320 + mainPadding) / area * 100) && `min ${separator.getAttribute("aria-valuemin")}, want ${(320 + mainPadding) / area * 100}`,
    off("aria-valuemax", 100 - (288 + panelPadding) / area * 100) && `max ${separator.getAttribute("aria-valuemax")}, want ${100 - (288 + panelPadding) / area * 100}`,
  ].filter(Boolean);
}), { message }).toEqual([]);

test("the open Search preview leaves the host page's focus and scroll alone", async ({ page }) => {
  // Built assets keep cold dev-server transforms out of the dialog's first wait.
  const previewPort = Number((globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.GALLERY_PREVIEW_PORT ?? 4174);
  await page.goto(`http://127.0.0.1:${previewPort}${shellGallery}?${new URLSearchParams({ preview: "Search · open" })}`);
  const initialSearch = page.frameLocator("iframe[title='Search · open']");
  await expect(initialSearch.getByRole("dialog", { name: "Search" })).toBeVisible();
  // The gallery's own primitive Command scrolls the page on mount, so measure what the preview does from the top.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("iframe[title='Search · open']").evaluate((element) => new Promise((resolve) => {
    element.addEventListener("load", resolve, { once: true });
    (element as HTMLIFrameElement).contentWindow!.location.reload();
  }));
  await expect(initialSearch.getByRole("dialog", { name: "Search" })).toBeVisible();
  const initialViewport = await page.evaluate(() => ({ scrollY, active: document.activeElement?.tagName, title: (document.activeElement as HTMLIFrameElement | null)?.title }));
  const searchFocus = await initialSearch.locator("body").evaluate((body) => ({ className: body.className, active: body.ownerDocument.activeElement?.outerHTML.slice(0, 160) }));
  expect(initialViewport.scrollY, JSON.stringify({ initialViewport, searchFocus })).toBe(0);
  expect(initialViewport.active).not.toBe("IFRAME");

  await page.getByLabel("Screen size").selectOption("tablet");
  await expect(page.locator("iframe[title='Search · open']")).toHaveAttribute("data-device-class", "tablet");
  await expect(initialSearch.getByRole("button", { name: "Close search" })).toHaveJSProperty("offsetHeight", 44);
  expect(await initialSearch.getByRole("option").first().evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
});

// One test per device keeps each sweep well inside the test deadline.
for (const device of ["desktop", "tablet"]) test(`shell skeletons render usable, contained content across ${device} gallery settings`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(shellGallery);
  const root = page.locator("[data-gallery-root]");
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
        // The gallery's controls change first; wait for the preview's own document to apply them.
        const applied = `html[data-device-class='${device}'][data-look='${look}'][data-mode='${mode}']`;
        await frame.locator(`${applied} ${selector}`).first().waitFor({ state: "visible" });
        // The frame takes its height from the preview's report, which can arrive after the content is visible.
        const previewFrame = await (await page.locator(`iframe[title='${id} · ${state}']`).elementHandle())!.contentFrame();
        await test.step(`${id} · ${state}: frame takes the content height`, () => previewFrame!.waitForFunction(() => window.innerHeight === Math.ceil(document.querySelector("#root")!.getBoundingClientRect().height)));
        return frame.locator("html").evaluate((element, { id, state, selector }) => {
          const rootElement = element.querySelector("#root");
          const dialog = element.querySelector<HTMLElement>("[role=dialog]");
          const bounds = dialog?.getBoundingClientRect();
          const content = element.querySelector<HTMLElement>(selector);
          const contentStyle = content && getComputedStyle(content);
          const rowsFit = [...(dialog?.querySelectorAll<HTMLElement>("[role=option]") ?? [])].every((row) => row.scrollWidth <= row.clientWidth);
          return {
            preview: `${id} · ${state}`,
            viewport: [element.clientWidth, element.clientHeight],
            dialogBounds: bounds && { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
            contained: element.scrollWidth <= element.clientWidth,
            rendered: !!rootElement?.childElementCount,
            alert: !!element.querySelector("[role=alert]"),
            contentVisible: !!content?.getClientRects().length && contentStyle?.visibility !== "hidden" && contentStyle?.opacity !== "0",
            dialogFits: !bounds || (bounds.left >= 0 && bounds.top >= 0 && bounds.right <= element.clientWidth && bounds.bottom <= element.clientHeight),
            dialogVisible: !dialog || !!(bounds?.width && bounds.height && getComputedStyle(dialog).visibility !== "hidden"),
            rowsFit,
          };
        }, { id, state, selector });
      }));
      expect(results.filter((result) => !result.contained || !result.rendered || result.alert || !result.contentVisible || !result.dialogFits || !result.dialogVisible || !result.rowsFit), `${device} ${look} ${mode}`).toEqual([]);
    }
  }
  expect(errors).toEqual([]);
});

test("the docked AppShell preview has a 44px handle, a full-height sidebar and usable panes", async ({ page }) => {
  await page.goto(galleryOf("AppShell"));
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
});

test("shell skeletons fit a 375px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(galleryOf("AppShell"));
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
      const textarea = page.getByRole("textbox", { name: "Message" });
      expect(await textarea.evaluate((element) => ({ min: getComputedStyle(element).minHeight, height: element.getBoundingClientRect().height >= 44 }))).toEqual({ min: "44px", height: true });
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
  await page.goto(galleryOf("AppShell"));
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
  // The group mounts with no height and needs a resize notification before it can lay out.
  await expect(handle).toHaveAttribute("aria-valuemin", "52");
  await expect(handle).toHaveAttribute("aria-valuemax", "76");
  await handle.evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }));
  const groupHeight = await group.evaluate((element) => element.getBoundingClientRect().height) - (await handle.evaluate((element) => element.getBoundingClientRect().height));
  await page.keyboard.press("End");
  await expect(handle).toHaveAttribute("aria-valuenow", "76");
  expect((await measure())[1].height).toBeGreaterThanOrEqual(Math.floor(groupHeight * 0.24));
  await page.keyboard.press("Home");
  await expect(handle).toHaveAttribute("aria-valuenow", "52");
  expect((await measure())[0].height).toBeGreaterThanOrEqual(Math.floor(groupHeight * 0.52));
});

test("AppShell preview heights settle at a usable size on tablet", async ({ page }) => {
  await page.goto(galleryOf("AppShell"));
  await page.getByLabel("Screen size").selectOption("tablet");
  for (const state of ["default", "docked"]) {
    const frame = page.locator(`iframe[title='AppShell · ${state}']`);
    await expect(frame).toHaveAttribute("data-device-class", "tablet");
    // A fixed point: the content is exactly as tall as the frame it is in, so the next height report cannot change it.
    await expect.poll(() => frame.evaluate((element) => {
      const preview = element as HTMLIFrameElement;
      const content = preview.contentDocument?.querySelector("#root");
      if (!content) return null;
      const root = content.getBoundingClientRect().height;
      const style = getComputedStyle(content.ownerDocument.documentElement);
      const token = parseFloat(style.getPropertyValue("--content-max-height")) * parseFloat(style.fontSize); // a rem token
      return { frame: Number(preview.height) === token, root: root === token, viewport: preview.contentWindow?.innerHeight === token };
    }), { message: state }).toEqual({ frame: true, root: true, viewport: true });
    const paneHeights = await frame.contentFrame().locator("[data-slot=resizable-panel]").evaluateAll((panes) => panes.map((pane) => pane.getBoundingClientRect().height));
    expect(Math.min(...paneHeights), state).toBeGreaterThanOrEqual(44);
  }
});

test("AppShell keeps usable slot minima at the docked threshold in each density", async ({ page }) => {
  await page.goto(galleryOf("AppShell"));
  await page.getByLabel("Screen size").selectOption("desktop");
  const frame = page.locator("iframe[title='AppShell · docked']");
  const app = page.frameLocator("iframe[title='AppShell · docked']");
  const handle = app.locator("[data-slot=resizable-handle]");
  const panels = app.locator("[data-slot=resizable-panel]");
  for (const density of ["comfortable", "spacious"]) {
    await page.getByLabel("Density").selectOption(density);
    await expect(app.locator("html")).toHaveAttribute("data-density", density);
    const threshold = await app.locator("[data-slot=resizable-panel-group]").evaluate((group) => {
      const shellChrome = window.innerWidth - group.getBoundingClientRect().width;
      const panes = [...group.querySelectorAll<HTMLElement>("[data-slot=resizable-panel]")];
      const slot = (panel: HTMLElement) => panel.querySelector<HTMLElement>("[class*='p-space-']")!;
      const padding = (element: HTMLElement) => {
        const style = getComputedStyle(slot(element));
        return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      };
      const handleWidth = group.querySelector<HTMLElement>("[data-slot=resizable-handle]")!.getBoundingClientRect().width;
      return shellChrome + 320 + padding(panes[0]) + 288 + padding(panes[1]) + handleWidth + 4;
    });
    await frame.evaluate((element, width) => {
      (element as HTMLIFrameElement).width = String(Math.ceil(width));
      (element as HTMLIFrameElement).style.width = `${Math.ceil(width)}px`;
    }, threshold);
    await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentWindow!.innerWidth)).toBe(Math.ceil(threshold));
    const geometry = await app.locator("[data-slot=resizable-panel-group]").evaluate((group) => ({
      window: innerWidth,
      group: group.getBoundingClientRect().width,
      sidebar: group.closest("[data-slot=sidebar-inset]")?.parentElement?.querySelector("[data-slot=sidebar]")?.getBoundingClientRect().width,
      handle: group.querySelector("[data-slot=resizable-handle]")?.getBoundingClientRect().width,
      slots: [...group.querySelectorAll<HTMLElement>("[data-slot=resizable-panel]")].map((panel) => panel.querySelector<HTMLElement>("[class*='p-space-']")?.getBoundingClientRect().width),
    }));
    await expect(handle, `${density} threshold ${threshold}; ${JSON.stringify(geometry)}`).toHaveAttribute("aria-orientation", "vertical");
    const measureUsableWidths = () => panels.evaluateAll((elements) => elements.map((panel) => {
      const slot = panel.querySelector<HTMLElement>("[class*='p-space-']")!;
      const style = getComputedStyle(slot);
      return slot.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    }));
    const assertMinimums = async () => {
      const widths = await measureUsableWidths();
      expect(widths[0]).toBeGreaterThanOrEqual(320);
      expect(widths[1]).toBeGreaterThanOrEqual(288);
    };
    await expectCurrentLimits(handle, `${density} limits at threshold ${threshold}`);
    await handle.focus();
    await page.keyboard.press("Home");
    await assertMinimums();
    await page.keyboard.press("End");
    await assertMinimums();
  }
});

test("AppShell measures its own width and keeps the draft and slot minima as it changes", async ({ page }) => {
  await page.goto(galleryOf());
  await page.evaluate(async () => {
    const fixtureUrl = "/tests/browser/shell-layout-entry.tsx";
    await import(/* @vite-ignore */ fixtureUrl) as typeof import("./shell-layout-entry");
    window.mountShellLayout();
  });
  const host = page.getByTestId("shell-host");
  const handle = host.locator("[data-slot=resizable-handle]");
  const draft = host.getByRole("textbox", { name: "Draft" });
  const resize = (width: number) => host.evaluate((element, value) => { element.style.width = `${value}px`; }, width);
  await draft.fill("unsent words");
  const original = await draft.elementHandle();
  // The panel opens after mount, in a host just wide enough to dock: both padded slots must still get their minimum.
  const paddedMinimums = await host.evaluate((element) => {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const space = (name: string) => parseFloat(getComputedStyle(element).getPropertyValue(name)) * rem; // rem tokens
    return 320 + 288 + 44 + 2 * space("--space-4") + 2 * space("--space-3");
  });
  const chrome = await host.evaluate((element) => element.getBoundingClientRect().width - element.querySelector("[data-slot=resizable-panel-group]")!.getBoundingClientRect().width);
  await resize(Math.ceil(chrome + paddedMinimums) + 2);
  await page.getByRole("button", { name: "Open panel" }).click();
  await expect(handle).toHaveAttribute("aria-orientation", "vertical");
  const usableWidths = () => host.locator("[data-slot=resizable-panel]").evaluateAll((panes) => panes.map((pane) => {
    const slot = pane.querySelector<HTMLElement>("[class*='p-space-']")!;
    const style = getComputedStyle(slot);
    return slot.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  }));
  await expectCurrentLimits(handle, "limits after the panel opens");
  await handle.focus();
  for (const key of ["Home", "End"]) {
    await page.keyboard.press(key);
    const [main, panel] = await usableWidths();
    expect(main, key).toBeGreaterThanOrEqual(320);
    expect(panel, key).toBeGreaterThanOrEqual(288);
  }
  // A narrow host inside a wide window stacks.
  await resize(800);
  await expect(handle).toHaveAttribute("aria-orientation", "horizontal");
  await resize(1201);
  await expect(handle).toHaveAttribute("aria-orientation", "vertical");
  await expect(draft).toHaveValue("unsent words");
  expect(await original!.evaluate((element) => element.isConnected)).toBe(true);
});

test("Search and Settings fit, filter, and return keyboard focus in a short viewport", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 375 });
  await page.goto(galleryOf());
  await page.evaluate(async () => {
    const fixtureUrl = "/tests/browser/shell-interactions-entry.tsx";
    await import(/* @vite-ignore */ fixtureUrl) as typeof import("./shell-interactions-entry");
    window.mountShellInteractions();
  });
  const appSearch = page.getByRole("button", { name: "Open app search" });
  await appSearch.click();
  const dialog = page.getByRole("dialog", { name: "Search" });
  const input = page.getByRole("combobox", { name: "Search conversations" });
  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();
  const dialogBounds = await dialog.boundingBox();
  expect(dialogBounds).not.toBeNull();
  expect(dialogBounds!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBounds!.y + dialogBounds!.height).toBeLessThanOrEqual(375);
  const closeBounds = await page.getByRole("button", { name: "Close search" }).boundingBox();
  expect(closeBounds).not.toBeNull();
  expect(closeBounds!.y).toBeGreaterThanOrEqual(0);
  const list = page.getByRole("listbox");
  expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await input.fill("planning");
  await expect(page.getByRole("option", { name: "Filtered result" })).toBeVisible();
  await input.clear();
  await expect(page.getByRole("option")).toHaveCount(30);
  expect(await page.evaluate(() => window.shellSearchQueries.at(-1))).toBe("");
  await page.keyboard.press("Escape");
  await appSearch.click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe("Search conversations");
  await input.fill("planning");
  await expect(page.getByRole("option", { name: "Filtered result" })).toBeVisible();
  await page.keyboard.press("Escape");
  await appSearch.click();
  await expect(input).toHaveValue("planning");
  await expect(page.getByRole("option", { name: "Filtered result" })).toBeVisible();
  expect(await page.evaluate(() => window.shellSearchQueries)).toEqual(["planning", "", "planning"]);
  // The app opened Search and its launcher is below the fold, so only the dialog itself is on screen.
  await expect(page.getByRole("button", { name: "Search", exact: true, includeHidden: true })).not.toBeInViewport();
  await expect.poll(() => page.evaluate(() => window.shellInteractionEvents.filter((event) => event.name === "component_seen" && event.component === "Search").length)).toBe(1);
  await page.keyboard.press("Escape");

  // Settings has been mounted and closed for longer than the seen delay that Search just waited out.
  expect(await page.evaluate(() => window.shellInteractionEvents.filter((event) => event.name === "component_seen" && event.component === "Settings"))).toEqual([]);
  const settingsOpener = page.getByRole("button", { name: "Open app settings" });
  await settingsOpener.click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await page.getByRole("tab", { name: "Change history" }).click();
  const settingsDialog = page.getByRole("dialog", { name: "Settings" });
  const settingsClose = page.getByRole("button", { name: "Close settings" });
  const settingsBounds = await settingsDialog.boundingBox();
  const settingsCloseBounds = await settingsClose.boundingBox();
  expect(settingsBounds).not.toBeNull();
  expect(settingsBounds!.y + settingsBounds!.height).toBeLessThanOrEqual(375);
  expect(settingsCloseBounds).not.toBeNull();
  expect(settingsCloseBounds!.y).toBeGreaterThanOrEqual(0);
  expect(await page.getByRole("tabpanel").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("Open app settings");
  await settingsOpener.click();
  await expect.poll(() => page.evaluate(() => window.shellInteractionEvents.some((event) => event.name === "component_seen" && event.component === "Settings" && event.default_state === "history"))).toBe(true);
});

test("native visibility reports the correct seen state for each shell", async ({ page }) => {
  await page.goto(galleryOf());
  await page.evaluate(async () => {
    const fixtureUrl = "/tests/browser/shell-seen-entry.tsx";
    await import(/* @vite-ignore */ fixtureUrl) as typeof import("./shell-seen-entry");
    window.mountShellSeen();
  });
  await expect.poll(() => page.evaluate(() => window.shellSeenEvents.filter((event) => event.name === "component_seen").length)).toBe(6);
  const seenEvents = await page.evaluate(() => window.shellSeenEvents.filter((event) => event.name === "component_seen"));
  const elapsed = await page.evaluate(() => window.shellSeenAt.map((at) => (at - window.shellMountedAt) / 1000));
  expect(elapsed).toHaveLength(6);
  expect(Math.min(...elapsed), "no component_seen before the seen delay").toBeGreaterThanOrEqual(SEEN_VISIBLE_SECONDS);
  for (const event of seenEvents) expect(event.seconds_visible, String(event.component)).toBeGreaterThanOrEqual(SEEN_VISIBLE_SECONDS);
  const states = await page.evaluate(() => window.shellSeenEvents.filter((event) => event.name === "component_seen").map(({ component, default_state }) => [component, default_state]).sort(([left], [right]) => left.localeCompare(right)));
  expect(states).toEqual([
    ["AppShell", "default"],
    ["ChatHeader", "standard"],
    ["Composer", "empty"],
    ["ConversationNavigation", "populated"],
    ["Search", "open"],
    ["Settings", "preferences"],
  ]);
});

test("a ChatHeader preview leaves the host page's focus and scroll alone", async ({ page }) => {
  await page.goto(galleryOf("ChatHeader"));
  const frame = page.locator("iframe[title='ChatHeader · with-settings']");
  const menu = frame.contentFrame().getByRole("menuitem", { name: "Conversation settings" });
  await expect(menu).toBeVisible();
  const look = page.getByLabel("Look");
  await look.focus();
  await frame.evaluate((element) => new Promise((resolve) => {
    element.addEventListener("load", resolve, { once: true });
    (element as HTMLIFrameElement).contentWindow!.location.reload();
  }));
  await expect(menu).toBeVisible();
  await expect(look).toBeFocused();
});

test("the open ChatHeader menu fits its settled preview and takes a pointer hit", async ({ page }) => {
  await page.goto(galleryOf("ChatHeader"));
  const frame = page.locator("iframe[title='ChatHeader · with-settings']");
  const item = frame.contentFrame().getByRole("menuitem", { name: "Conversation settings" });
  for (const device of ["desktop", "tablet"]) {
    await page.getByLabel("Screen size").selectOption(device);
    await expect(frame).toHaveAttribute("data-device-class", device);
    await expect(item).toBeVisible();
    await expect.poll(() => item.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const hit = element.ownerDocument.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      const root = element.ownerDocument.querySelector("#root")!.getBoundingClientRect().height;
      return {
        inside: bounds.top >= 0 && bounds.bottom <= element.ownerDocument.defaultView!.innerHeight,
        hit: element.contains(hit),
        settled: Math.abs(element.ownerDocument.defaultView!.innerHeight - Math.ceil(root)) <= 1,
      };
    }), { message: device }).toEqual({ inside: true, hit: true, settled: true });
    expect(await item.evaluate((element) => (element as HTMLElement).offsetHeight), device).toBeGreaterThanOrEqual(44);
  }
});

test("the Composer file picker action meets the touch target in every density", async ({ page }) => {
  await page.goto(galleryOf("Composer"));
  await page.getByLabel("Screen size").selectOption("tablet");
  const composer = page.frameLocator("iframe[title='Composer · empty']");
  for (const density of ["compact", "comfortable", "spacious"]) {
    await page.getByLabel("Density").selectOption(density);
    await expect(composer.locator("html")).toHaveAttribute("data-density", density);
    await composer.getByRole("button", { name: "Add attachment" }).press("Enter");
    const item = composer.getByRole("menuitem", { name: "Add photos or files" });
    await expect(item).toBeVisible();
    // offset sizes ignore the menu's opening zoom.
    const size = await item.evaluate((element) => ({ width: (element as HTMLElement).offsetWidth, height: (element as HTMLElement).offsetHeight }));
    expect(size.width, `${density} width`).toBeGreaterThanOrEqual(44);
    expect(size.height, `${density} height`).toBeGreaterThanOrEqual(44);
    await item.press("Escape");
    await expect(item).toHaveCount(0);
  }
});

test("Search returns focus to whatever opened it", async ({ page }) => {
  await page.goto(galleryOf());
  await page.evaluate(async () => {
    const fixtureUrl = "/tests/browser/shell-interactions-entry.tsx";
    await import(/* @vite-ignore */ fixtureUrl) as typeof import("./shell-interactions-entry");
    window.mountShellInteractions();
  });
  const input = page.getByRole("combobox", { name: "Search conversations" });
  for (const opener of [page.getByRole("button", { name: "Open app search" }), page.getByRole("button", { name: "Search", exact: true })]) {
    await opener.press("Enter");
    await expect(input).toBeFocused();
    await input.press("Escape");
    await expect(page.getByRole("dialog", { name: "Search" })).toHaveCount(0);
    await expect(opener).toBeFocused();
  }
});
