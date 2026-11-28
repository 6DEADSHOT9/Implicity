import { gunzipSync } from "node:zlib";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { openPickerPreview } from "./widget-picker-test-helpers";

// Both gallery servers have a fake key and this intercepted host. The default test server has the
// gallery opt-in off; the second server (playwright.config.ts) is built with it on.
const captureHost = "http://posthog.invalid";
const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const optedIn = `http://127.0.0.1:${env.GALLERY_CAPTURE_TEST_PORT ?? Number(env.GALLERY_TEST_PORT ?? 5174) + 1}`;
// The SDK drops events from browsers that look automated, so present as ordinary Chrome.
test.use({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" });

type Waiter = { test: (entry: string) => boolean; done: () => void };
const waiters = new WeakMap<string[], Waiter[]>();

/** Every request for the SDK module or to the capture host, from the page and its preview frames, with decoded bodies. */
async function watchCapture(context: BrowserContext) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "userAgentData", { get: () => undefined });
  });
  const seen: string[] = [];
  const waiting: Waiter[] = [];
  waiters.set(seen, waiting);
  await context.route(`${captureHost}/**`, (route) => {
    const body = route.request().postDataBuffer();
    const entry = `${route.request().url()} ${body ? (body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : body).toString("utf8") : ""}`;
    seen.push(entry);
    for (const waiter of waiting) if (waiter.test(entry)) waiter.done();
    return route.fulfill({ status: 200, contentType: "application/json", body: '{"status":1}', headers: { "access-control-allow-origin": route.request().headers().origin ?? "*", "access-control-allow-credentials": "true" } });
  });
  context.on("request", (request) => { if (/posthog-js/.test(request.url())) seen.push(request.url()); });
  return seen;
}

const sent = (seen: string[], name: string) => seen.some((entry) => entry.startsWith(`${captureHost}/e/`) && entry.includes(`"${name}"`));

/**
 * Resolves when an event request matching `test` reaches the capture host: an event, not a polled
 * window, so a busy server delays it without failing it. The test's own timeout still bounds it.
 */
function captured(seen: string[], name: string, also: (entry: string) => boolean = () => true) {
  const test = (entry: string) => sent([entry], name) && also(entry);
  return new Promise<void>((done) => { if (seen.some(test)) done(); else waiters.get(seen)?.push({ test, done }); });
}

/** The real gallery page: its provider renders with the heading, so an enabled one has already requested the SDK. */
async function openGallery(page: Page, base = "") {
  await page.goto(`${base}/`);
  await page.getByRole("heading", { name: "Skeleton gallery" }).click();
}

/**
 * The real gallery and preview runtime, focused on one entry; acts in the preview once it is ready.
 * A preview frame starts 1px tall and grows when the preview reports its height, so a click before
 * then lands outside the frame: wait for the rendered preview and its real height first.
 */
async function useChipPreview(page: Page, base = "") {
  const title = "ShortcutChips · suggested";
  await page.goto(`${base}/tests/browser/focused-gallery.html?ids=ShortcutChips`);
  await page.waitForFunction((target) => {
    const frame = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe")).find((item) => item.title === target);
    return !!frame?.contentDocument?.querySelector("#root")?.childElementCount && Number(frame.height) > 1;
  }, title);
  await page.locator(`iframe[title="${title}"]`).scrollIntoViewIfNeeded();
  await page.frameLocator(`iframe[title="${title}"]`).getByRole("button", { name: "Copy answer" }).click();
}

test("the real gallery page sends nothing when the gallery has not opted in", async ({ page, context }) => {
  const seen = await watchCapture(context);
  await openGallery(page);
  expect(seen).toEqual([]);
});

test("a gallery preview sends nothing when the gallery has not opted in", async ({ page, context }) => {
  const seen = await watchCapture(context);
  await useChipPreview(page);
  // An enabled preview provider requests the SDK module while it renders, before the click is possible.
  expect(seen).toEqual([]);
});

test("control: with the opt-in, the real gallery page sends to the capture host", async ({ page, context }) => {
  const seen = await watchCapture(context);
  await openGallery(page, optedIn);
  await captured(seen, "session_started");
});

// A separate page from the gallery control: the full opted-in gallery loads every preview with
// the whole registry and the SDK, which must not still be loading while this preview is checked.
test("control: with the opt-in, a gallery preview sends to the capture host", async ({ page, context }) => {
  const seen = await watchCapture(context);
  await useChipPreview(page, optedIn);
  await captured(seen, "shortcut_used");
});

test("an opted-in WidgetPicker preview sends setting_changed for the widget it names", async ({ page, context }) => {
  const seen = await watchCapture(context);
  await page.goto(`${optedIn}/tests/browser/focused-gallery.html?ids=WidgetPicker`);
  await openPickerPreview(page, "WidgetPicker · open");
  const resume = page.frameLocator("iframe[title='WidgetPicker · open']").getByRole("switch", { name: "Resume" });
  await resume.click();
  await expect(resume).toHaveAttribute("aria-checked", "false");
  await captured(seen, "setting_changed", (entry) => entry.includes('"ResumeWidget"'));
});

test("an enabled MessageActions whose parent displays the new form sends representation_switched for answer_form", async ({ page, context }) => {
  const seen = await watchCapture(context);
  await page.goto("/tests/browser/capture-enabled.html");
  await page.getByRole("button", { name: "List" }).click();
  await expect(page.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
  await captured(seen, "representation_switched", (entry) => entry.includes('"answer_form"') && entry.includes('"list"'));
});
