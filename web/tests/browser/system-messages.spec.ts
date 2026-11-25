import { expect, test } from "@playwright/test";

test("system message Skeletons render across every gallery setting", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const entries = ["ChangeNotice", "ProposalCard", "Nudge"];
  for (const id of entries) {
    const card = page.locator(`[data-skeleton='${id}']`);
    await expect(card).toHaveCount(1);
    const frame = card.locator("iframe");
    await expect(frame).toHaveAttribute("title", new RegExp(id));
    await expect(page.frameLocator(`iframe[title^='${id}']`).locator("button")).toHaveCount(2);
  }

  for (const look of ["default", "focused", "notebook"]) {
    await page.getByLabel("Look").selectOption(look);
    for (const mode of ["light", "dark"]) {
      await page.getByLabel("Mode").selectOption(mode);
      for (const id of entries) {
        const preview = page.frameLocator(`iframe[title^='${id}']`);
        await expect(preview.locator(id === "ProposalCard" ? "[role='region']" : "[role='status']")).toHaveCount(1);
        await expect(preview.locator("button").first()).toHaveCSS("font-family", new RegExp(look === "notebook" ? "Source Serif 4" : look === "focused" ? "IBM Plex Mono" : "Inter"));
      }
    }
  }
  for (const density of ["compact", "comfortable", "spacious"]) await page.getByLabel("Density").selectOption(density);
  for (const textSize of ["1", "2", "3", "4", "5"]) await page.getByLabel("Text size").selectOption(textSize);
  for (const screenSize of ["desktop", "tablet"]) {
    await page.getByLabel("Screen size").selectOption(screenSize);
    for (const id of entries) {
      await expect(page.locator(`[data-skeleton='${id}'] iframe`)).toHaveAttribute("width", screenSize === "desktop" ? "1440" : "800");
      await expect(page.frameLocator(`iframe[title^='${id}']`).locator(id === "ProposalCard" ? "[role='region']" : "[role='status']")).toHaveCount(1);
    }
  }
  expect(errors).toEqual([]);
});
