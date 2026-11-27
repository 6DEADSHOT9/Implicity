import { expect, type Page } from "@playwright/test";

export async function openPickerPreview(page: Page, title: string) {
  const iframe = page.locator(`iframe[title="${title}"]`);
  await iframe.scrollIntoViewIfNeeded();
  await page.waitForFunction((targetTitle) => {
    const frame = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe")).find((item) => item.title === targetTitle);
    return !!frame?.contentDocument?.querySelector("#root")?.childElementCount && Number(frame.height) > 1;
  }, title);

  let previous = "";
  let stablePolls = 0;
  await expect.poll(async () => {
    const current = await iframe.evaluate((frame) => {
      const { x, y, width, height } = frame.getBoundingClientRect();
      return [Number((frame as HTMLIFrameElement).height), x, y, width, height].map((value) => Math.round(value * 10) / 10).join(":");
    });
    stablePolls = current === previous ? stablePolls + 1 : 0;
    previous = current;
    return stablePolls >= 3;
  }).toBe(true);

  const customize = iframe.contentFrame().getByRole("button", { name: "Customize" });
  await customize.click();
  await expect.poll(() => page.locator('iframe[title^="WidgetPicker · "]').evaluateAll((frames) => (frames as HTMLIFrameElement[]).filter((frame) => frame.contentDocument?.querySelector("[data-widget-picker-dialog]")).map((frame) => frame.title))).toEqual([title]);
  await expect(iframe.contentFrame().locator("[data-widget-picker-dialog]")).toBeVisible();
}
