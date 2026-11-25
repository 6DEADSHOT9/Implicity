import { expect, test } from "@playwright/test";
import type { CapturedEvent } from "../../src/registry";

test("native IntersectionObserver detects a scroll across the half-visible boundary", async ({ page }) => {
  await page.goto("/tests/browser/use-seen.html?below-half");
  await page.locator("#seen-target").waitFor();
  expect(await page.evaluate(() => window.scrollY)).toBe(51);
  await page.waitForTimeout(3100);
  expect(await page.evaluate(() => window.seenEvents)).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 50));
  await expect.poll(() => page.evaluate(() => window.seenEvents.length), { timeout: 6500 }).toBe(1);
  const [event] = await page.evaluate(() => window.seenEvents) as Extract<CapturedEvent, { name: "component_seen" }>[];
  expect(event.seconds_visible).toBeGreaterThanOrEqual(3);
});

test("a hidden data-visible ancestor is not seen and starts a new stretch after reveal", async ({ page }) => {
  await page.goto("/tests/browser/use-seen.html");
  await page.locator("#seen-target").waitFor();
  await page.locator("#opacity-parent").evaluate((element) => element.setAttribute("data-visible", "false"));
  await page.waitForTimeout(3100);
  expect(await page.evaluate(() => window.seenEvents)).toEqual([]);
  await page.locator("#opacity-parent").evaluate((element) => element.setAttribute("data-visible", "true"));
  await expect.poll(() => page.evaluate(() => window.seenEvents.length), { timeout: 7000 }).toBe(1);
  const [event] = await page.evaluate(() => window.seenEvents) as Extract<CapturedEvent, { name: "component_seen" }>[];
  expect(event.seconds_visible).toBeGreaterThanOrEqual(3);
});

test("unrelated class changes do not restart visible time", async ({ page }) => {
  await page.goto("/tests/browser/use-seen.html");
  await page.locator("#seen-target").waitFor();
  await page.evaluate(() => {
    const target = document.querySelector("#seen-target")!;
    let changes = 0;
    const interval = setInterval(() => {
      target.classList.toggle("unrelated-class");
      if (++changes === 10) clearInterval(interval);
    }, 400);
  });
  await expect.poll(() => page.evaluate(() => window.seenEvents.length), { timeout: 5000 }).toBe(1);
  const [event] = await page.evaluate(() => window.seenEvents) as Extract<CapturedEvent, { name: "component_seen" }>[];
  expect(event.seconds_visible).toBeGreaterThanOrEqual(3);
});

test("a scroll exit before a blocked deadline cancels the occasion", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeObserver = window.IntersectionObserver;
    window.delaySeenObserver = false;
    window.pendingSeenObserverCallbacks = [];
    window.IntersectionObserver = class extends NativeObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super((entries, observer) => {
          if (window.delaySeenObserver) window.pendingSeenObserverCallbacks.push(() => callback(entries, observer));
          else callback(entries, observer);
        }, options);
      }
      takeRecords() { return []; }
    };
  });
  await page.goto("/tests/browser/use-seen.html");
  await page.locator("#seen-target").waitFor();
  await page.waitForTimeout(100);
  await page.evaluate(() => { window.delaySeenObserver = true; });
  await page.waitForTimeout(2700);
  await page.evaluate(() => {
    window.scrollTo(0, 1500);
    const startedAt = performance.now();
    while (performance.now() - startedAt < 600) { /* hold the event loop */ }
  });
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.seenEvents)).toEqual([]);
  expect(await page.evaluate(() => window.pendingSeenObserverCallbacks.length)).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.delaySeenObserver = false;
    for (const notify of window.pendingSeenObserverCallbacks.splice(0)) notify();
  });
  expect(await page.evaluate(() => window.seenEvents)).toEqual([]);
});

test("a wall-clock adjustment does not change the reported visible duration", async ({ page }) => {
  await page.addInitScript(() => {
    const originalNow = Date.now.bind(Date);
    Date.now = () => originalNow() - 60_000;
    window.restoreSeenClock = () => { Date.now = originalNow; };
  });
  await page.goto("/tests/browser/use-seen.html");
  await page.locator("#seen-target").waitFor();
  await expect.poll(() => page.evaluate(() => window.seenEvents.length), { timeout: 5000 }).toBe(1);
  const [event] = await page.evaluate(() => window.seenEvents) as Extract<CapturedEvent, { name: "component_seen" }>[];
  await page.evaluate(() => window.restoreSeenClock());
  expect(event.seconds_visible).toBeGreaterThanOrEqual(3);
  expect(event.seconds_visible).toBeLessThan(5);
});

test("a replaced ref target cannot emit twice in one mount, but a remount can", async ({ page }) => {
  await page.goto("/tests/browser/use-seen.html");
  await page.locator("#seen-target").waitFor();
  await expect.poll(() => page.evaluate(() => window.seenEvents.length), { timeout: 5000 }).toBe(1);
  await page.evaluate(() => window.seenTest.replaceTarget());
  await page.waitForTimeout(3100);
  expect(await page.evaluate(() => window.seenEvents)).toHaveLength(1);
  await page.evaluate(() => window.seenTest.toggleMount());
  await expect(page.locator("#seen-target")).toHaveCount(0);
  await page.evaluate(() => window.seenTest.toggleMount());
  await expect.poll(() => page.evaluate(() => window.seenEvents.length), { timeout: 5000 }).toBe(2);
});
