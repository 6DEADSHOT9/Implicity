import { expect, test } from "@playwright/test";
import type { CapturedEvent } from "../../src/registry";

test("native IntersectionObserver starts the occasion at the half-visible crossing", async ({ page }) => {
  await page.goto("/tests/browser/use-seen.html");
  await page.locator("#seen-target").waitFor();
  await page.locator("#clip").evaluate((element) => { (element as HTMLElement).style.height = "49px"; });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.seenEvents)).toEqual([]);
  await page.locator("#clip").evaluate((element) => { (element as HTMLElement).style.height = "50px"; });
  await expect.poll(() => page.evaluate(() => window.seenEvents.length), { timeout: 5000 }).toBe(1);
  const [event] = await page.evaluate(() => window.seenEvents) as Extract<CapturedEvent, { name: "component_seen" }>[];
  expect(event).toMatchObject({ name: "component_seen", component: "ReviewPanel", slot: "main", default_state: "plain" });
  expect(event.seconds_visible).toBeGreaterThanOrEqual(3);
});

test("the timer rechecks current visibility after a delayed callback", async ({ page }) => {
  await page.goto("/tests/browser/use-seen.html");
  await page.locator("#seen-target").waitFor();
  await page.waitForTimeout(2700);
  await page.evaluate(() => {
    const originalNow = Date.now;
    Date.now = () => originalNow() - 60_000;
    const startedAt = performance.now();
    while (performance.now() - startedAt < 600) { /* hold the event loop */ }
    Date.now = originalNow;
  });
  await expect.poll(() => page.evaluate(() => window.seenEvents.length), { timeout: 2000 }).toBe(1);
  const [event] = await page.evaluate(() => window.seenEvents) as Extract<CapturedEvent, { name: "component_seen" }>[];
  expect(event.seconds_visible).toBeGreaterThan(3.2);
  expect(event.seconds_visible).toBeLessThan(4);
});

const hiddenCases = [
  { name: "visibility hidden", selector: "#seen-target", property: "visibility", value: "hidden", restore: "visible" },
  { name: "target opacity zero", selector: "#seen-target", property: "opacity", value: "0", restore: "1" },
  { name: "ancestor opacity zero", selector: "#opacity-parent", property: "opacity", value: "0", restore: "1" },
  { name: "display none", selector: "#seen-target", property: "display", value: "none", restore: "block" },
];

for (const { name, selector, property, value, restore } of hiddenCases) {
  test(`does not count an in-viewport element with ${name}`, async ({ page }) => {
    await page.goto("/tests/browser/use-seen.html");
    await page.locator("#seen-target").waitFor();
    await page.locator(selector).evaluate((element, change) => {
      (element as HTMLElement).style.setProperty(change.property, change.value);
    }, { property, value });
    await page.waitForTimeout(3100);
    expect(await page.evaluate(() => window.seenEvents)).toEqual([]);
    if (name === "visibility hidden") {
      await page.locator(selector).evaluate((element, change) => {
        (element as HTMLElement).style.setProperty(change.property, change.value);
      }, { property, value: restore });
      await expect.poll(() => page.evaluate(() => window.seenEvents.length), { timeout: 5000 }).toBe(1);
    }
  });
}

test("a replaced ref target cannot emit twice in one mount, but a remount can", async ({ page }) => {
  await page.goto("/tests/browser/use-seen.html");
  await page.locator("#seen-target").waitFor();
  await expect.poll(() => page.evaluate(() => window.seenEvents.length), { timeout: 5000 }).toBe(1);
  await page.evaluate(() => window.seenTest.replaceTarget());
  await page.waitForTimeout(3100);
  expect(await page.evaluate(() => window.seenEvents)).toHaveLength(1);
  await page.evaluate(() => window.seenTest.toggleMount());
  await page.evaluate(() => window.seenTest.toggleMount());
  await expect.poll(() => page.evaluate(() => window.seenEvents.length), { timeout: 5000 }).toBe(2);
});
