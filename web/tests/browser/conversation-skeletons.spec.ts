import { createServer, get as getHttps, type Server } from "node:https";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

let imageServer: Server | undefined;

test.afterEach(async () => {
  if (!imageServer) return;
  await new Promise<void>((resolve) => imageServer!.close(() => resolve()));
  imageServer = undefined;
});

test("conversation skeletons wrap at 375px and MessageBody keeps links safe and controls absent", async ({ page }) => {
  const remoteRequests: { url: string; headers: Record<string, string> }[] = [];
  let imageResponseHeaders: Record<string, string> | undefined;
  let imageServerRequests = 0;
  imageServer = createServer({
    key: readFileSync(new URL("./fixtures/no-cors.key", import.meta.url)),
    cert: readFileSync(new URL("./fixtures/no-cors.crt", import.meta.url)),
  }, (_request, response) => {
    imageServerRequests++;
    response.writeHead(200, { "content-type": "image/png" });
    response.end(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS2cAAAAASUVORK5CYII=", "base64"));
  });
  await new Promise<void>((resolve) => imageServer!.listen(0, "127.0.0.1", resolve));
  const address = imageServer.address();
  if (!address || typeof address === "string") throw new Error("HTTPS image fixture did not bind");
  const imageUrl = `https://127.0.0.1:${address.port}/favicon.ico`;
  await page.route("https://tracker.invalid/**", async (route) => {
    const request = route.request();
    remoteRequests.push({ url: request.url(), headers: await request.allHeaders() });
    if (new URL(request.url()).pathname !== "/success.png") return route.abort();
    const image = await new Promise<{ status: number; contentType: string; headers: Record<string, string | string[] | undefined>; body: Buffer }>((resolve, reject) => {
      getHttps(imageUrl, { rejectUnauthorized: false }, (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => resolve({
          status: response.statusCode ?? 500,
          contentType: String(response.headers["content-type"] ?? "image/png"),
          headers: response.headers,
          body: Buffer.concat(chunks),
        }));
      }).on("error", reject);
    });
    imageResponseHeaders = Object.fromEntries(Object.entries(image.headers).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    await route.fulfill({ status: image.status, headers: { "content-type": image.contentType }, body: image.body });
  });
  const httpRequests: string[] = [];
  page.on("request", (request) => { if (request.url().startsWith("http://tracker.invalid/")) httpRequests.push(request.url()); });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/tests/browser/conversation-skeletons.html");
  const cases = page.locator(".case");
  await expect(cases).toHaveCount(9);
  const bodyWidth = await page.locator("body").evaluate((body) => ({ width: body.scrollWidth, offenders: [...body.querySelectorAll("*")].filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => ({ skeleton: node.closest(".case")?.getAttribute("data-skeleton"), tag: node.tagName, className: (node as HTMLElement).className, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth })).slice(0, 12) }));
  expect(bodyWidth, JSON.stringify(bodyWidth)).toMatchObject({ width: 375 });
  const overflow = await cases.evaluateAll((elements) => elements.flatMap((element) => {
    const nodes = [element, ...element.querySelectorAll("*")];
    return nodes.filter((node) => node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflowX !== "auto" && getComputedStyle(node).overflowX !== "scroll")
      .map((node) => ({ skeleton: element.getAttribute("data-skeleton"), tag: node.tagName, className: (node as HTMLElement).className, width: node.clientWidth, scrollWidth: node.scrollWidth, rect: node.getBoundingClientRect().toJSON(), offenders: [...node.querySelectorAll("*")].filter((child) => child.getBoundingClientRect().right > node.getBoundingClientRect().right + 1).map((child) => ({ tag: child.tagName, className: (child as HTMLElement).className, rect: child.getBoundingClientRect().toJSON() })) }));
  }));
  expect(overflow, JSON.stringify(overflow)).toEqual([]);

  const approval = page.locator("[data-skeleton='ApprovalRequest']");
  const title = await approval.getByRole("heading").boundingBox();
  const firstAction = await approval.getByRole("button", { name: "Approve" }).boundingBox();
  expect(title).not.toBeNull();
  expect(firstAction).not.toBeNull();
  expect(firstAction!.x).toBeGreaterThanOrEqual(title!.x);
  expect(firstAction!.height).toBeGreaterThanOrEqual(44);

  const activity = page.locator("[data-skeleton='RunActivity']");
  const activityTrigger = activity.getByRole("button");
  const contentId = await activityTrigger.getAttribute("aria-controls");
  expect(contentId).toBeTruthy();
  await expect(activity.locator(`#${contentId}`)).toHaveAttribute("role", "region");

  const message = page.locator("[data-skeleton='MessageBody']");
  const link = message.getByRole("link", { name: "Long link" });
  await expect(page.locator("main")).toHaveAttribute("data-look", "default");
  await expect(link).toHaveAttribute("href", /^https:\/\/tracker\.invalid\//);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(message.locator("button")).toHaveCount(0);
  await expect(message.getByRole("img", { name: "blocked — tracker.invalid" })).toBeVisible();
  const longAltPlaceholder = message.getByRole("img", { name: `${"unbrokenalt".repeat(40)} — tracker.invalid` });
  await expect(longAltPlaceholder).toBeVisible();
  expect((await longAltPlaceholder.boundingBox())!.width).toBeLessThanOrEqual(351);
  await expect(message.getByRole("img", { name: "failed preview — tracker.invalid" })).toBeVisible();
  await expect(message.getByRole("img", { name: "Cross-origin preview" })).toBeVisible();
  const image = message.locator('img[src="https://tracker.invalid/success.png"]');
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
  expect(await image.getAttribute("crossorigin")).toBeNull();
  await expect(message).toContainText('<picture><source srcset="http://tracker.invalid/picture.png 1x, data:image/png;base64,AAAA 2x"><img src="http://tracker.invalid/picture.png" alt="raw html"></picture>');
  await expect(message.locator("p code")).toHaveClass(/rounded-md/);
  await expect(message.locator("table")).toBeVisible();
  await expect(message.locator("pre code").filter({ hasText: "unlabeled code block" })).toHaveClass(/language-text/);
  await expect(message.locator("blockquote")).toHaveClass(/border-s-token/);
  await expect(message.locator("hr")).toHaveClass(/border-b-token/);
  expect(httpRequests).toEqual([]);
  expect(remoteRequests.map(({ url }) => new URL(url).pathname).sort()).toEqual(["/fail.png", "/success.png"]);
  for (const request of remoteRequests) expect(request.headers).not.toHaveProperty("referer");
  const imageRequest = remoteRequests.find(({ url }) => url === "https://tracker.invalid/success.png")!;
  expect(imageRequest.headers).not.toHaveProperty("origin");
  expect(imageServerRequests).toBe(1);
  expect(imageResponseHeaders).not.toHaveProperty("access-control-allow-origin");
});
