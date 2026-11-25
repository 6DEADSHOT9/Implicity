import { expect, test } from "@playwright/test";

test("system message Skeletons render across every gallery setting", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const previews = [
    ["ChangeNotice", "inline"],
    ["ChangeNotice", "toast"],
    ["ProposalCard", "preview"],
    ["Nudge", "prompt"],
  ] as const;
  const expectHeadingToken = async (id: string, state: string) => {
    const preview = page.frameLocator(`iframe[title='${id} · ${state}']`);
    const tokenSize = await preview.locator("html").evaluate((element) => {
      const probe = document.createElement("span");
      probe.style.fontSize = "var(--heading-4)";
      element.append(probe);
      const size = getComputedStyle(probe).fontSize;
      probe.remove();
      return size;
    });
    await expect(preview.getByRole("heading").first()).toHaveCSS("font-size", tokenSize);
  };
  for (const [id, state] of previews) {
    const card = page.locator(`[data-skeleton='${id}'][data-gallery-state='${state}']`);
    await expect(card).toHaveCount(1);
    const frame = card.locator("iframe");
    await expect(frame).toHaveAttribute("title", `${id} · ${state}`);
    await expect(page.frameLocator(`iframe[title='${id} · ${state}']`).locator("button")).toHaveCount(2);
  }

  for (const look of ["default", "focused", "notebook"]) {
    await page.getByLabel("Look").selectOption(look);
    for (const mode of ["light", "dark"]) {
      await page.getByLabel("Mode").selectOption(mode);
      for (const [id, state] of previews) {
        const preview = page.frameLocator(`iframe[title='${id} · ${state}']`);
        await expect(preview.locator(id === "ProposalCard" ? "[role='region']" : "[role='status']")).toHaveCount(1);
        await expect(preview.locator("button").first()).toHaveCSS("font-family", new RegExp(look === "notebook" ? "Source Serif 4" : look === "focused" ? "IBM Plex Mono" : "Inter"));
        await expectHeadingToken(id, state);
      }
    }
  }
  for (const density of ["compact", "comfortable", "spacious"]) {
    await page.getByLabel("Density").selectOption(density);
    for (const [id, state] of previews) await expectHeadingToken(id, state);
  }
  for (const textSize of ["1", "2", "3", "4", "5"]) {
    await page.getByLabel("Text size").selectOption(textSize);
    for (const [id, state] of previews) await expectHeadingToken(id, state);
  }
  for (const screenSize of ["desktop", "tablet"]) {
    await page.getByLabel("Screen size").selectOption(screenSize);
    for (const [id, state] of previews) {
      await expect(page.locator(`[data-skeleton='${id}'][data-gallery-state='${state}'] iframe`)).toHaveAttribute("width", screenSize === "desktop" ? "1440" : "800");
      await expect(page.frameLocator(`iframe[title='${id} · ${state}']`).locator(id === "ProposalCard" ? "[role='region']" : "[role='status']")).toHaveCount(1);
      await expectHeadingToken(id, state);
    }
  }
  expect(errors).toEqual([]);
});
