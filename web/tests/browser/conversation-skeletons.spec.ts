import { expect, test } from "@playwright/test";

test("conversation skeletons wrap at 375px and MessageBody keeps links safe and controls absent", async ({ page }) => {
  const remoteRequests: { url: string; headers: Record<string, string> }[] = [];
  await page.route("https://tracker.invalid/**", async (route) => {
    remoteRequests.push({ url: route.request().url(), headers: await route.request().allHeaders() });
    if (route.request().url().endsWith("/fail.png")) return route.abort();
    await route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS2cAAAAASUVORK5CYII=", "base64") });
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
  await expect(message.getByRole("img", { name: "failed preview — tracker.invalid" })).toBeVisible();
  await expect(message.getByRole("img", { name: "Cross-origin preview" })).toBeVisible();
  const image = message.locator('img[src="https://tracker.invalid/success.png"]');
  await expect(image).toHaveJSProperty("naturalWidth", 1);
  await expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(image).not.toHaveAttribute("crossorigin", /.+/);
  await expect(message).toContainText('<picture><source srcset="http://tracker.invalid/picture.png 1x, data:image/png;base64,AAAA 2x"><img src="http://tracker.invalid/picture.png" alt="raw html"></picture>');
  await expect(message.locator("p code")).toHaveClass(/rounded-md/);
  await expect(message.locator("blockquote")).toHaveClass(/border-s-token/);
  await expect(message.locator("hr")).toHaveClass(/border-b-token/);
  expect(httpRequests).toEqual([]);
  expect(remoteRequests.map(({ url }) => new URL(url).pathname).sort()).toEqual(["/fail.png", "/success.png"]);
  for (const request of remoteRequests) expect(request.headers).not.toHaveProperty("referer");
});
