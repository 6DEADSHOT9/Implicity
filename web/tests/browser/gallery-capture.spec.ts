import { gunzipSync } from "node:zlib";
import { expect, test, type BrowserContext } from "@playwright/test";

// The Playwright web server sets a fake key and this host, with the gallery opt-in off.
const captureHost = "http://posthog.invalid";
// The SDK drops events from browsers that look automated, so present as ordinary Chrome.
test.use({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" });

/** Every request for the SDK module or to the capture host, from the page and its preview frames. */
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

test("the gallery and its previews send nothing when the gallery has not opted in", async ({ page, context }) => {
  const seen = await watchCapture(context);
  await page.goto("/");
  const chips = page.frameLocator("iframe[title='ShortcutChips · suggested']").getByRole("button", { name: "Copy answer" });
  await chips.click();
  await page.getByRole("heading").first().click();
  // A provider that is enabled requests the SDK module while it renders, so once the
  // gallery and a preview have rendered and been used, any capture would have started.
  expect(seen).toEqual([]);
});

test("control: an enabled provider on the same server requests the SDK and sends to the capture host", async ({ page, context }) => {
  const seen = await watchCapture(context);
  await page.goto("/tests/browser/capture-enabled.html");
  await page.getByRole("button", { name: "Search" }).click();
  await expect.poll(() => seen.some((entry) => entry.startsWith(`${captureHost}/e/`) && entry.includes("shortcut_used"))).toBe(true);
  expect(seen.some((entry) => /posthog-js/.test(entry))).toBe(true);
});
