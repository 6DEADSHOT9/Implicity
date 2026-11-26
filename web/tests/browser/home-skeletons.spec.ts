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
  for (const [id, state] of homeEntries) {
    const frame = page.frameLocator(`iframe[title='${id} · ${state}']`);
    const heading = frame.getByRole("heading");
    if (["ResumeWidget", "ProjectsWidget", "ScheduledWidget", "QuickPromptsWidget", "NowPlayingWidget"].includes(id)) {
      await expect(frame.getByRole("list")).toBeVisible();
    } else {
      await expect(heading).toBeVisible();
    }
    const target = ["ResumeWidget", "ProjectsWidget", "ScheduledWidget", "QuickPromptsWidget", "NowPlayingWidget"].includes(id)
      ? frame.getByRole("list")
      : heading;
    const bounds = await target.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const root = element.ownerDocument.documentElement;
      const view = element.ownerDocument.defaultView!;
      return { width: rect.width, left: rect.left, right: rect.right, viewport: view.innerWidth, scrollWidth: root.scrollWidth };
    });
    expect(bounds.width, `${id} title width`).toBeGreaterThan(100);
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.viewport);
    if (!["ResumeWidget", "ProjectsWidget", "ScheduledWidget", "QuickPromptsWidget", "NowPlayingWidget"].includes(id)) {
      await expect(frame.getByRole("region").first()).toBeVisible();
    }
  }
  const picker = page.frameLocator("iframe[title='WidgetPicker · long-content']");
  await expect(picker.getByRole("dialog")).toBeVisible();
}

test("Home Skeleton titles fit in the gallery across looks, modes and preview sizes", async ({ page }) => {
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  const trigger = page.getByRole("button", { name: "Customize" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Choose Home widgets" });
  await expect(dialog).toBeVisible();
  const dimensions = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewport = element.ownerDocument.defaultView!;
    const scroll = element.querySelector('[data-slot="scroll-area-viewport"]')!;
    const scrollRoot = scroll.parentElement!;
    const close = element.querySelector('[aria-label="Close widget picker"]')!.getBoundingClientRect();
    return {
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      viewportWidth: viewport.innerWidth, viewportHeight: viewport.innerHeight,
      scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight, scrollRootHeight: scrollRoot.getBoundingClientRect().height, scrollRootClass: scrollRoot.className, scrollParentHeight: scrollRoot.parentElement!.getBoundingClientRect().height, scrollParentClass: scrollRoot.parentElement!.className,
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
