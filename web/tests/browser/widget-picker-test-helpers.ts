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

  const dialog = iframe.contentFrame().locator("[data-widget-picker-dialog]");
  if (!(await dialog.count())) await iframe.contentFrame().getByRole("button", { name: "Customize" }).click();
  await expect(dialog).toBeVisible();
}
