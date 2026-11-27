import { expect, type Page } from "@playwright/test";

export async function openPickerPreview(page: Page, title: string) {
  const iframe = page.locator(`iframe[title="${title}"]`);
  await iframe.scrollIntoViewIfNeeded();
  await page.waitForFunction((targetTitle) => {
    const frame = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe")).find((item) => item.title === targetTitle);
    return !!frame?.contentDocument?.querySelector("#root")?.childElementCount && Number(frame.height) > 1;
  }, title);
  await iframe.scrollIntoViewIfNeeded();

  const dialog = iframe.contentFrame().locator("[data-widget-picker-dialog]");
  if (!(await dialog.count())) await iframe.contentFrame().getByRole("button", { name: "Customize" }).click();
  await expect(dialog).toBeVisible();
}
