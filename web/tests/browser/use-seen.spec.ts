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

test("a tall narrow component counts when half of the component is visible", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tests/browser/use-seen.html");
  const target = page.locator("#seen-target");
  await target.evaluate((element) => {
    Object.assign(element.style, { width: "160px", height: "900px" });
  });
  const visibleRatio = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const visibleHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    return visibleHeight / rect.height;
  });
  expect(visibleRatio).toBeGreaterThan(0.9);
  await expect.poll(() => page.evaluate(() => window.seenEvents.length), { timeout: 5000 }).toBe(1);
});

test("an offscreen scroll area is not seen until it enters the window", async ({ page }) => {
  await page.goto("/tests/browser/offscreen-scroll-seen.html?offscreen");
  await expect.poll(() => page.evaluate(() => window.offscreenRootVisible)).toBe(false);
  const startedAt = await page.evaluate(() => performance.now());
  await expect.poll(() => page.evaluate((start) => performance.now() - start, startedAt), { timeout: 5000 }).toBeGreaterThanOrEqual(3200);
  expect(await page.evaluate(() => window.seenEvents)).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect.poll(() => page.evaluate(() => window.offscreenRootVisible)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.seenEvents.length), { timeout: 6500 }).toBe(1);
});

test("a target outside a partly visible scroll area is not seen until the target enters the window", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tests/browser/offscreen-scroll-seen.html");
  await page.locator("#seen-target").waitFor();
  const startedAt = await page.evaluate(() => performance.now());
  await expect.poll(() => page.evaluate((start) => performance.now() - start, startedAt), { timeout: 5000 }).toBeGreaterThanOrEqual(3200);
  expect(await page.evaluate(() => window.seenEvents)).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 100));
  await expect.poll(() => page.evaluate(() => window.seenEvents.length), { timeout: 6500 }).toBe(1);
});

test("a tall target must cover half the scroll area after window clipping", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tests/browser/offscreen-scroll-seen.html?tall");
  await page.locator("#seen-target").waitFor();
  await page.evaluate(() => window.scrollTo(0, 100));
  const startedAt = await page.evaluate(() => performance.now());
  await expect.poll(() => page.evaluate((start) => performance.now() - start, startedAt), { timeout: 5000 }).toBeGreaterThanOrEqual(3200);
  expect(await page.evaluate(() => window.seenEvents)).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 150));
  await expect.poll(() => page.evaluate(() => window.seenEvents.length), { timeout: 6500 }).toBe(1);
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
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(60_000);
  await page.addInitScript(() => {
    const NativeObserver = window.IntersectionObserver;
    window.seenObserverReady = false;
    window.delaySeenObserver = false;
    window.pendingSeenObserverCallbacks = [];
    window.IntersectionObserver = class extends NativeObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super((entries, observer) => {
          // Native entries need to share the clock used by the hook's timer.
          for (const entry of entries) Object.defineProperty(entry, "time", { value: performance.now() });
          if (window.delaySeenObserver) window.pendingSeenObserverCallbacks.push(() => callback(entries, observer));
          else {
            callback(entries, observer);
            window.seenObserverReady = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
          }
        }, options);
      }
      takeRecords() { return []; }
    };
  });
  await page.goto("/tests/browser/use-seen.html");
  await expect.poll(() => page.evaluate(() => window.seenObserverReady)).toBe(true);
  await page.clock.runFor(2700);
  await page.evaluate(() => {
    window.delaySeenObserver = true;
    window.scrollTo(0, 1500);
  });
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  await expect.poll(() => page.evaluate(() => window.pendingSeenObserverCallbacks.length)).toBe(1);
  await page.clock.runFor(600);
  expect(await page.evaluate(() => window.seenEvents)).toEqual([]);
  // The deadline requests a fresh sample while the exit callback is still held.
  await expect.poll(() => page.evaluate(() => window.pendingSeenObserverCallbacks.length)).toBe(2);
  await page.evaluate(() => {
    window.delaySeenObserver = false;
    for (const notify of window.pendingSeenObserverCallbacks.splice(0)) notify();
  });
  expect(await page.evaluate(() => window.seenEvents)).toEqual([]);
});

test("a wall-clock adjustment does not change the reported visible duration", async ({ page }) => {
  await page.goto("/tests/browser/use-seen.html");
  await page.locator("#seen-target").waitFor();
  await page.evaluate(() => new Promise<void>((resolve) => {
    const target = document.querySelector("#seen-target")!;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        observer.disconnect();
        resolve();
      }
    }, { threshold: [0, 0.5] });
    observer.observe(target);
  }));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.seenEvents)).toEqual([]);
  await page.evaluate(() => {
    const originalNow = Date.now.bind(Date);
    Date.now = () => originalNow() - 60_000;
    window.restoreSeenClock = () => { Date.now = originalNow; };
  });
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
