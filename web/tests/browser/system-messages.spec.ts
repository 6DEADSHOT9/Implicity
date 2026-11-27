import { expect, test } from "@playwright/test";
import registrySnapshot from "../../../contracts/generated/components/registry.json" with { type: "json" };
import { measureContrast } from "./contrast";

async function expectPanelsInsideFrames(page: import("@playwright/test").Page, previews: readonly (readonly [string, string])[]) {
  for (const [id, state] of previews) {
    const component = page.frameLocator(`iframe[title='${id} · ${state}']`).locator(id === "ProposalCard" ? "[role='region']" : "[role='status']");
    await expect.poll(async () => component.evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      const view = element.ownerDocument.defaultView!;
      return x >= 0 && y >= 0 && x + width <= view.innerWidth && y + height <= view.innerHeight;
    })).toBe(true);
  }
}

async function clickByPointer(page: import("@playwright/test").Page, button: import("@playwright/test").Locator) {
  const bounds = await button.boundingBox();
  expect(bounds).not.toBeNull();
  const point = { x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height / 2 };
  const hit = await button.evaluate((element, pagePoint) => {
    const view = element.ownerDocument.defaultView!;
    const rect = view.frameElement!.getBoundingClientRect();
    const target = view.document.elementFromPoint((pagePoint.x - rect.x) / (rect.width / view.innerWidth), (pagePoint.y - rect.y) / (rect.height / view.innerHeight));
    return target === element || element.contains(target);
  }, point);
  expect(hit).toBe(true);
  await page.mouse.click(point.x, point.y);
}

test("system message Skeletons render across every gallery setting", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tests/browser/focused-gallery.html?ids=ChangeNotice,ProposalCard,Nudge");
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
    await expect.poll(async () => Number(await frame.getAttribute("height"))).toBeGreaterThan(1);
    const preview = page.frameLocator(`iframe[title='${id} · ${state}']`);
    const component = preview.locator(id === "ProposalCard" ? "[role='region']" : "[role='status']");
    await expect(component).toBeVisible();
    if (id === "ChangeNotice" && state === "inline") await expect(component.getByRole("heading")).toHaveCSS("font-weight", "700");
    await expect.poll(() => component.evaluate((element) => element.checkVisibility({ opacityProperty: true, visibilityProperty: true }))).toBe(true);
    const bounds = () => component.evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      const view = element.ownerDocument.defaultView!;
      return { x, y, width, height, inside: x >= 0 && y >= 0 && x + width <= view.innerWidth && y + height <= view.innerHeight };
    });
    await expect.poll(async () => (await bounds()).inside).toBe(true);
    const componentBounds = await bounds();
    expect(componentBounds.inside, `${id} ${state} bounds: ${JSON.stringify(componentBounds)}`).toBe(true);
    if (id === "ProposalCard") await expect(component).toHaveAttribute("data-slot", "card");
    else if (id === "ChangeNotice" && state === "inline") await expect(component.locator("[data-slot='marker']")).toHaveCount(1);
    else await expect(component).toHaveAttribute("data-slot", "alert");
    if (id === "Nudge") await expect(component.locator("[data-slot='alert-description']")).toHaveCSS("grid-column-start", "2");
    const buttons = preview.locator("button");
    await expect(buttons).toHaveCount(2);
    for (const button of await buttons.all()) {
      await expect(button).toBeVisible();
      await expect.poll(async () => {
        return button.evaluate((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          const view = element.ownerDocument.defaultView!;
          return x >= 0 && y >= 0 && x + width <= view.innerWidth && y + height <= view.innerHeight;
        });
      }, { message: `${id} ${state} action stays inside its frame` }).toBe(true);
      await expect(button).toHaveAttribute("data-slot", "button");
    }
    await buttons.first().press("Tab");
    await expect(buttons.nth(1)).toBeFocused();
    expect(await buttons.nth(1).evaluate((button) => getComputedStyle(button).boxShadow)).not.toBe("none");
    await buttons.nth(1).press("Enter");
    for (const button of await buttons.all()) await clickByPointer(page, button);
  }

  for (const look of ["default", "focused", "notebook"]) {
    await page.getByLabel("Look").selectOption(look);
    await expectPanelsInsideFrames(page, previews);
    for (const mode of ["light", "dark"]) {
      await page.getByLabel("Mode").selectOption(mode);
      await expectPanelsInsideFrames(page, previews);
      for (const [id, state] of previews) {
        const preview = page.frameLocator(`iframe[title='${id} · ${state}']`);
        await expect(preview.locator(id === "ProposalCard" ? "[role='region']" : "[role='status']")).toHaveCount(1);
        await expect(preview.locator("button").first()).toHaveCSS("font-family", new RegExp(look === "notebook" ? "Source Serif 4" : look === "focused" ? "IBM Plex Mono" : "Inter"));
        for (const button of await preview.locator("button").all()) {
          const contrast = await button.evaluate(measureContrast);
          expect(contrast.ratio, `${id} ${state} ${look} ${mode}`).toBeGreaterThanOrEqual(4.5);
        }
        await expectHeadingToken(id, state);
      }
      const toast = page.frameLocator("iframe[title='ChangeNotice · toast']");
      await expect(toast.locator("html")).toHaveAttribute("data-mode", mode);
      await expect(toast.locator("[data-sonner-toaster]")).toHaveAttribute("data-sonner-theme", mode);
      await expect(toast.locator("[data-sonner-toast]")).toBeVisible();
      await expect.poll(() => toast.locator("[data-sonner-toast]").evaluate((element) => element.checkVisibility({ opacityProperty: true, visibilityProperty: true }))).toBe(true);
      const toastStyle = await toast.locator("[data-sonner-toaster]").evaluate((element) => ({ width: getComputedStyle(element).getPropertyValue("--width").trim(), widthToken: getComputedStyle(document.documentElement).getPropertyValue("--panel-width").trim(), background: getComputedStyle(element).getPropertyValue("--normal-bg").trim(), backgroundToken: getComputedStyle(document.documentElement).getPropertyValue("--popover").trim() }));
      expect(toastStyle.width).toBe(toastStyle.widthToken);
      expect(toastStyle.background).toBe(toastStyle.backgroundToken);
      await expectPanelsInsideFrames(page, previews);
    }
  }
  for (const density of ["compact", "comfortable", "spacious"]) {
    await page.getByLabel("Density").selectOption(density);
    await expectPanelsInsideFrames(page, previews);
    for (const [id, state] of previews) await expectHeadingToken(id, state);
  }
  for (const textSize of ["1", "2", "3", "4", "5"]) {
    await page.getByLabel("Text size").selectOption(textSize);
    await expectPanelsInsideFrames(page, previews);
    for (const [id, state] of previews) await expectHeadingToken(id, state);
  }
  for (const screenSize of ["desktop", "tablet"]) {
    await page.getByLabel("Screen size").selectOption(screenSize);
    await expectPanelsInsideFrames(page, previews);
    for (const [id, state] of previews) {
      await expect(page.locator(`[data-skeleton='${id}'][data-gallery-state='${state}'] iframe`)).toHaveAttribute("width", screenSize === "desktop" ? "1440" : "800");
      await expect(page.frameLocator(`iframe[title='${id} · ${state}']`).locator(id === "ProposalCard" ? "[role='region']" : "[role='status']")).toHaveCount(1);
      await expectHeadingToken(id, state);
    }
  }
  const toast = page.frameLocator("iframe[title='ChangeNotice · toast']");
  const toastButton = toast.getByRole("button", { name: "Keep" });
  await expect(toastButton).toBeVisible();
  await toastButton.scrollIntoViewIfNeeded();
  const toastRect = await toastButton.boundingBox();
  expect(toastRect).not.toBeNull();
  await expect.poll(() => toast.getByRole("status").evaluate((element) => element.checkVisibility({ opacityProperty: true, visibilityProperty: true }))).toBe(true);
  await toast.locator("[data-sonner-toaster]").evaluate((element) => { (element as HTMLElement).style.opacity = "0"; });
  expect(await toast.getByRole("status").evaluate((element) => element.checkVisibility({ opacityProperty: true, visibilityProperty: true }))).toBe(false);
  await toast.locator("[data-sonner-toaster]").evaluate((element) => { (element as HTMLElement).style.opacity = ""; });
  await expect.poll(() => toast.getByRole("status").evaluate((element) => element.checkVisibility({ opacityProperty: true, visibilityProperty: true }))).toBe(true);
  await page.mouse.click(toastRect!.x + toastRect!.width / 2, toastRect!.y + toastRect!.height / 2);
  expect(errors).toEqual([]);
});

const galleryCohorts = Array.from({ length: 4 }, (_, cohort) => ({
  name: `cohort ${cohort + 1}`,
  ids: registrySnapshot.components.filter((_, index) => index % 4 === cohort),
}));

async function mountRealGallery(page: import("@playwright/test").Page, componentIds: string[]) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // The fake clock sends errors from timers it runs on its own to the console, not to pageerror.
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  // The fake clock gives delayed preview errors a defined window without a real wait.
  await page.clock.install();
  await page.goto(`/tests/browser/focused-gallery.html?ids=${encodeURIComponent(componentIds.join(","))}`);
  const expectedFrames = await page.locator("iframe").count();
  expect(expectedFrames).toBeGreaterThan(0);
  const waitForEverySetting = async () => {
    const expected = await Promise.all(["Look", "Mode", "Density", "Text size", "Screen size"].map(async (label) => [label, await page.getByLabel(label).inputValue()] as const));
    const settings = Object.fromEntries(expected) as Record<string, string>;
    const expectedKey = JSON.stringify({ look: settings.Look, mode: settings.Mode, density: settings.Density, textSize: settings["Text size"], deviceClass: settings["Screen size"] });
    try {
      await page.waitForFunction(({ expectedCount, key }) => {
        const frames = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe"));
        const unready = frames.filter((frame) => {
          const document = frame.contentDocument;
          if (!document?.querySelector("#root > *")) return true;
          const { dataset } = document.documentElement;
          return JSON.stringify({ look: dataset.look, mode: dataset.mode, density: dataset.density, textSize: dataset.textSize, deviceClass: dataset.deviceClass }) !== key;
        }).map((frame) => frame.title);
        (window as Window & { unreadyPreviews?: string[] }).unreadyPreviews = unready;
        return frames.length === expectedCount && unready.length === 0;
      }, { expectedCount: expectedFrames, key: expectedKey }, { timeout: 10_000 });
    } catch (error) {
      const unready = await page.evaluate(() => (window as Window & { unreadyPreviews?: string[] }).unreadyPreviews ?? []);
      throw new Error(`Gallery previews did not apply ${expectedKey}: ${unready.join(", ")}`, { cause: error });
    }
  };
  const expectNoFallbacks = async () => {
    const previewTexts = await page.locator("iframe").evaluateAll((frames) => (frames as HTMLIFrameElement[]).map((frame) => frame.contentDocument?.querySelector("#root")?.textContent ?? ""));
    expect(previewTexts.filter((text) => /Preview unavailable|preview failed/.test(text))).toEqual([]);
  };
  const expectHealthyPreviews = async () => {
    await page.clock.runFor(5_000);
    await expectNoFallbacks();
    expect(errors).toEqual([]);
  };
  await waitForEverySetting();
  return { waitForEverySetting, expectNoFallbacks, expectHealthyPreviews };
}

// One walk per cohort: each setting carries into the next, so combinations such as dark and tablet are seen.
for (const cohort of galleryCohorts) {
  test(`real gallery ${cohort.name} has no uncaught preview errors across settings`, async ({ page }) => {
    const { waitForEverySetting, expectNoFallbacks, expectHealthyPreviews } = await mountRealGallery(page, cohort.ids);
    const select = async (label: string, value: string) => {
      await page.getByLabel(label).selectOption(value);
      await waitForEverySetting();
    };
    for (const look of ["default", "focused", "notebook"]) {
      await select("Look", look);
      for (const mode of ["light", "dark"]) await select("Mode", mode);
    }
    for (const density of ["compact", "comfortable", "spacious"]) await select("Density", density);
    for (const textSize of ["1", "2", "3", "4", "5"]) await select("Text size", textSize);
    // A screen size change reloads every frame, which would drop an earlier fallback.
    await expectNoFallbacks();
    for (const screenSize of ["desktop", "tablet"]) await select("Screen size", screenSize);
    await expectHealthyPreviews();
  });
}

test("ChangeNotice shown events follow native disclosure and completed opacity reveals", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const fixtureUrl = "/tests/browser/system-messages-entry.tsx";
    const { mountVisibilityCases } = await import(/* @vite-ignore */ fixtureUrl) as typeof import("./system-messages-entry");
    mountVisibilityCases();
  });
  const events = () => page.evaluate(() => window.systemMessageEvents);
  await expect.poll(async () => (await events()).length).toBe(0);
  await page.locator("#details-case summary").scrollIntoViewIfNeeded();
  await page.locator("#details-case summary").click();
  await page.locator("#details-case [role='status']").scrollIntoViewIfNeeded();
  await expect.poll(async () => (await events()).some((event) => event.name === "change_shown" && event.decision_id === "dec_323e4567-e89b-42d3-a456-426614174000")).toBe(true);

  await page.locator("#opacity-case [role='status']").scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise<void>((resolve) => {
    const element = document.querySelector<HTMLElement>("#opacity-case")!;
    element.addEventListener("transitionend", () => resolve(), { once: true });
    window.revealOpacity();
  }));
  await expect.poll(async () => (await events()).some((event) => event.name === "change_shown" && event.decision_id === "dec_423e4567-e89b-42d3-a456-426614174000")).toBe(true);
});

test("Keep reports an opacity-revealed toast shown before the action", async ({ page }) => {
  await page.goto("/");
  await page.addStyleTag({ content: "[data-sonner-toaster] { opacity: 0; transition: opacity 180ms linear; }" });
  await page.evaluate(async () => {
    const fixtureUrl = "/tests/browser/system-messages-entry.tsx";
    const { mountOpacityToast } = await import(/* @vite-ignore */ fixtureUrl) as typeof import("./system-messages-entry");
    mountOpacityToast();
  });
  const host = page.locator("[data-sonner-toaster]").first();
  await expect(host).toHaveCount(1);
  const notice = page.getByRole("status", { name: "Opacity toast" });
  await expect(notice).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.systemMessageEvents.length)).toBe(0);
  await page.evaluate(() => new Promise<void>((resolve) => {
    const toaster = document.querySelector<HTMLElement>("[data-sonner-toaster]")!;
    toaster.addEventListener("transitionend", () => resolve(), { once: true });
    requestAnimationFrame(() => { toaster.style.opacity = "1"; });
  }));
  await notice.getByRole("button", { name: "Keep" }).click();
  const names = await page.evaluate(() => window.systemMessageEvents.map((event) => event.name));
  expect(names).toEqual(["component_shown", "change_shown", "change_kept"]);
  expect(await page.evaluate(() => window.noticeActions)).toEqual(["opacity:keep"]);
});

test("shown inline actions work when only 38% of the notice remains visible", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const fixtureUrl = "/tests/browser/system-messages-entry.tsx";
    const { mountPartialInlineNotice } = await import(/* @vite-ignore */ fixtureUrl) as typeof import("./system-messages-entry");
    mountPartialInlineNotice();
  });
  const notice = page.getByRole("status", { name: "Partial inline notice" });
  await notice.scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.systemMessageEvents.some((event) => event.name === "change_shown" && "decision_id" in event && event.decision_id === "dec_623e4567-e89b-42d3-a456-426614174000"))).toBe(true);
  await notice.getByRole("button", { name: "Keep" }).evaluate((button) => { (button as HTMLElement).style.cssText = "position: fixed; top: 177px; left: 32px; z-index: 10000"; });
  await notice.getByRole("button", { name: "Undo" }).evaluate((button) => { (button as HTMLElement).style.cssText = "position: fixed; top: 224px; left: 32px; z-index: 10000"; });
  await page.evaluate(() => {
    const notice = document.querySelector<HTMLElement>("[role='status'][aria-labelledby]")!;
    const bounds = notice.getBoundingClientRect();
    window.scrollBy(0, bounds.top + bounds.height * 0.62);
  });
  await expect.poll(() => notice.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return Math.max(0, Math.min(bounds.bottom, innerHeight) - Math.max(bounds.top, 0)) / bounds.height;
  })).toBeGreaterThan(0.35);
  const ratio = await notice.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return Math.max(0, Math.min(bounds.bottom, innerHeight) - Math.max(bounds.top, 0)) / bounds.height;
  });
  expect(ratio).toBeCloseTo(0.38, 1);
  const keep = notice.getByRole("button", { name: "Keep" });
  await expect(keep).toBeInViewport();
  const keepBounds = await keep.boundingBox();
  expect(keepBounds).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(keepBounds!.x).toBeGreaterThanOrEqual(0);
  expect(keepBounds!.y).toBeGreaterThanOrEqual(0);
  expect(keepBounds!.x + keepBounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(keepBounds!.y + keepBounds!.height).toBeLessThanOrEqual(viewport.height);
  await page.mouse.click(keepBounds!.x + keepBounds!.width / 2, keepBounds!.y + keepBounds!.height / 2);
  const undo = notice.getByRole("button", { name: "Undo" });
  await undo.focus();
  await undo.press("Enter");
  expect(await page.evaluate(() => window.noticeActions)).toEqual(["keep", "undo"]);
  expect(await page.evaluate(() => window.systemMessageEvents.filter((event) => "decision_id" in event && event.decision_id === "dec_623e4567-e89b-42d3-a456-426614174000").map((event) => event.name))).toEqual(["change_shown", "change_kept", "change_undone"]);
});

test("concurrent Decision toasts stack and route each pointer action to its own Decision", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const fixtureUrl = "/tests/browser/system-messages-entry.tsx";
    const { mountConcurrentNotices } = await import(/* @vite-ignore */ fixtureUrl) as typeof import("./system-messages-entry");
    mountConcurrentNotices();
  });
  const first = page.getByRole("status", { name: "First decision" });
  const second = page.getByRole("status", { name: "Second decision" });
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await page.getByLabel("Mode").selectOption("dark");
  await expect(page.locator("[data-sonner-toaster]").first()).toHaveAttribute("data-sonner-theme", "dark");
  for (const [notice, title] of [[first, "First"], [second, "Second"]] as const) {
    for (const action of ["Keep", "Undo"] as const) {
      const button = notice.getByRole("button", { name: action });
      await expect(button).toBeVisible();
      await button.click();
      await expect.poll(() => page.evaluate(() => window.noticeActions)).toContain(`${title.toLowerCase()}:${action.toLowerCase()}`);
    }
  }
  expect(await page.evaluate(() => window.noticeActions)).toEqual(["first:keep", "first:undo", "second:keep", "second:undo"]);
});
