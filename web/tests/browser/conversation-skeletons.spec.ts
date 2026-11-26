import { expect, test } from "@playwright/test";

test("conversation skeletons wrap at 375px and MessageBody keeps links safe and controls absent", async ({ page }) => {
  const remoteRequests: { url: string; headers: Record<string, string> }[] = [];
  await page.route("https://tracker.invalid/**", async (route) => {
    remoteRequests.push({ url: route.request().url(), headers: await route.request().allHeaders() });
    await route.abort();
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

  const message = page.locator("[data-skeleton='MessageBody']");
  const link = message.getByRole("link", { name: "Long link" });
  await expect(link).toHaveAttribute("href", /^https:\/\/tracker\.invalid\//);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(message.locator("button")).toHaveCount(0);
  await expect(message.getByRole("img", { name: "blocked — tracker.invalid" })).toBeVisible();
  await expect(message.getByRole("img", { name: "Remote preview — tracker.invalid" })).toBeVisible();
  expect(httpRequests).toEqual([]);
  expect(remoteRequests).toHaveLength(1);
  expect(remoteRequests[0].headers).not.toHaveProperty("cookie");
  expect(remoteRequests[0].headers).not.toHaveProperty("referer");
});
