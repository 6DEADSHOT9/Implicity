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

/** Every request for the SDK module or to the capture host, from the page and its preview frames, with decoded bodies. */
async function watchCapture(context: BrowserContext) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "userAgentData", { get: () => undefined });
  });
  const seen: string[] = [];
  await context.route(`${captureHost}/**`, (route) => {
    const body = route.request().postDataBuffer();
    seen.push(`${route.request().url()} ${body ? (body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : body).toString("utf8") : ""}`);
    return route.fulfill({ status: 200, contentType: "application/json", body: '{"status":1}', headers: { "access-control-allow-origin": route.request().headers().origin ?? "*", "access-control-allow-credentials": "true" } });
  });
  context.on("request", (request) => { if (/posthog-js/.test(request.url())) seen.push(request.url()); });
  return seen;
}

const sent = (seen: string[], name: string) => seen.some((entry) => entry.startsWith(`${captureHost}/e/`) && entry.includes(`"${name}"`));

/** The real gallery page: its provider renders with the heading, so an enabled one has already requested the SDK. */
async function openGallery(page: Page, base = "") {
  await page.goto(`${base}/`);
  await page.getByRole("heading", { name: "Skeleton gallery" }).click();
}

/** The real gallery and preview runtime, focused on one entry so its preview is ready quickly; acts in the preview. */
async function useChipPreview(page: Page, base = "") {
  await page.goto(`${base}/tests/browser/focused-gallery.html?ids=ShortcutChips`);
  await page.frameLocator("iframe[title='ShortcutChips · suggested']").getByRole("button", { name: "Copy answer" }).click();
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

test("control: with the opt-in, the real gallery page and a preview both send to the capture host", async ({ page, context }) => {
  const seen = await watchCapture(context);
  await openGallery(page, optedIn);
  await expect.poll(() => sent(seen, "session_started")).toBe(true);
  await useChipPreview(page, optedIn);
  await expect.poll(() => sent(seen, "shortcut_used")).toBe(true);
});

test("an opted-in WidgetPicker preview sends setting_changed for the widget it names", async ({ page, context }) => {
  const seen = await watchCapture(context);
  await page.goto(`${optedIn}/tests/browser/focused-gallery.html?ids=WidgetPicker`);
  await openPickerPreview(page, "WidgetPicker · open");
  const resume = page.frameLocator("iframe[title='WidgetPicker · open']").getByRole("switch", { name: "Resume" });
  await resume.click();
  await expect(resume).toHaveAttribute("aria-checked", "false");
  await expect.poll(() => seen.some((entry) => sent([entry], "setting_changed") && entry.includes('"ResumeWidget"'))).toBe(true);
});

test("an enabled MessageActions whose parent displays the new form sends representation_switched for answer_form", async ({ page, context }) => {
  const seen = await watchCapture(context);
  await page.goto("/tests/browser/capture-enabled.html");
  await page.getByRole("button", { name: "List" }).click();
  await expect(page.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => seen.some((entry) => sent([entry], "representation_switched") && entry.includes('"answer_form"') && entry.includes('"list"'))).toBe(true);
});
