import { expect, test } from "@playwright/test";

test("shell skeletons remain visible and contained across gallery settings", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const previews = [
    ["AppShell", "default"], ["AppShell", "docked"],
    ["ConversationNavigation", "populated"], ["ConversationNavigation", "empty"],
    ["Composer", "empty"], ["Composer", "with-attachments"],
    ["ChatHeader", "standard"], ["ChatHeader", "with-settings"],
    ["Search", "closed"], ["Search", "open"],
    ["Settings", "preferences"], ["Settings", "notices"],
  ] as const;
  const root = page.locator("[data-gallery-root]");
  for (const device of ["desktop", "tablet"]) {
    await page.getByLabel("Screen size").selectOption(device);
    await expect(root).toHaveAttribute("data-device-class", device);
    for (const look of ["default", "focused", "notebook"]) {
      await page.getByLabel("Look").selectOption(look);
      await expect(root).toHaveAttribute("data-look", look);
      for (const mode of ["light", "dark"]) {
        await page.getByLabel("Mode").selectOption(mode);
        await expect(root).toHaveAttribute("data-mode", mode);
      }
    }
    for (const density of ["compact", "comfortable", "spacious"]) {
      await page.getByLabel("Density").selectOption(density);
      await expect(root).toHaveAttribute("data-density", density);
    }
    for (const textSize of ["1", "2", "3", "4", "5"]) {
      await page.getByLabel("Text size").selectOption(textSize);
      await expect(root).toHaveAttribute("data-text-size", textSize);
    }
    const results = await Promise.all(previews.map(async ([id, state]) => {
      const frame = page.frameLocator(`iframe[title='${id} · ${state}']`);
      return frame.locator("html").evaluate((element) => ({
        contained: element.scrollWidth <= element.clientWidth,
        rendered: !!element.querySelector("#root")?.childElementCount,
        device: element.dataset.deviceClass,
      }));
    }));
    expect(results.filter(({ contained, rendered, device: frameDevice }) => !contained || !rendered || frameDevice !== device)).toEqual([]);
  }
  expect(errors).toEqual([]);
});
