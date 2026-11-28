import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import defaultLook from "../../../contracts/looks/default.json" with { type: "json" };
import focusedLook from "../../../contracts/looks/focused.json" with { type: "json" };
import notebookLook from "../../../contracts/looks/notebook.json" with { type: "json" };
import { lookTokenValues } from "../../src/look-tokens";

async function stubQuota(page: import("@playwright/test").Page) {
  await page.route("**/api/quota", (route) => route.fulfill({ json: {
    state: "ok",
    windows: [{ label: "Weekly", used_percent: 28, resets_at: "2026-12-01T00:00:00Z" }],
    resets_at: null,
    checked_at: "2026-11-28T00:00:00Z",
  } }));
}

async function chatCoverage(element: import("@playwright/test").Locator) {
  return element.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    let root: HTMLElement | null = node.parentElement;
    while (root && !/(auto|scroll|overlay)/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
    if (!root) throw new Error("Chat message list was not scrollable");
    const bounds = root.getBoundingClientRect();
    const width = Math.max(0, Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left));
    const height = Math.max(0, Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top));
    const visibleWidth = Math.max(0, Math.min(width, innerWidth - Math.max(0, bounds.left)));
    const visibleHeight = Math.max(0, Math.min(height, innerHeight - Math.max(0, bounds.top)));
    return { coversList: width * height > bounds.width * bounds.height / 2, coversWindow: visibleWidth * visibleHeight >= innerWidth * innerHeight / 2, list: [width, height, bounds.width, bounds.height], window: [visibleWidth, visibleHeight, innerWidth, innerHeight] };
  });
}

test("chat page applies the default look to the document root", async ({ page }) => {
  await stubQuota(page);
  await page.goto("/chat.html");
  const look = await page.locator("body").evaluate((body) => ({
    id: document.documentElement.dataset.look,
    token: getComputedStyle(document.documentElement).getPropertyValue("--font-body").replaceAll('"', "").trim(),
    font: getComputedStyle(body).fontFamily,
  }));
  expect(look.id).toBe("default");
  expect(look.token).not.toBe("");
  expect(look.font).toBe(look.token);
});

test("an open long answer counts as seen when it covers half a 375px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tests/browser/seen-fixture.html");
  const answer = page.getByRole("region", { name: "Long answer" });
  await expect(answer).toHaveAttribute("data-state", "open");
  const geometry = await answer.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const width = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    const height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    return { height: rect.height, coveredViewport: width * height >= innerWidth * innerHeight / 2 };
  });
  expect(geometry.height).toBeGreaterThan(812);
  expect(geometry.coveredViewport).toBe(true);
  await page.waitForFunction(() => Boolean((window.seenEvents as Array<{ name: string; slot?: string }>).some((event) => event.name === "component_seen" && event.slot === "long_answer")), null, { timeout: 5000 });
});

test("a tall narrow component counts when half of the component is visible", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/tests/browser/tall-narrow-seen.html");
  const visible = await page.locator("body > #root > div").first().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width * Math.min(rect.height, innerHeight) >= rect.width * rect.height / 2;
  });
  expect(visible).toBe(true);
  await expect.poll(() => page.evaluate(() => window.seenEvents.filter((event) => event.name === "component_seen" && event.component === "TallNarrowProbe").length), { timeout: 5000 }).toBe(1);
});

test("an open long answer in the 375px chat is seen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const id = "550e8400-e29b-41d4-a716-446655440050";
  const answer = `Long answer.\n\n${"A long paragraph remains in the chat viewport. ".repeat(520)}`;
  const messages = [
    { id: "user-1", role: "user", content: "A previous prompt. ".repeat(420) },
    { id: "assistant-1", role: "assistant", content: answer },
  ];
  await page.route("**/api/conversations", (route) => route.fulfill({ json: [{ id, title: "New chat" }] }));
  await page.route(`**/api/conversations/${id}`, (route) => route.fulfill({ json: { id, title: "New chat", messages } }));
  await stubQuota(page);
  await page.goto("/tests/browser/chat-seen-fixture.html");
  const slot = page.locator('[data-slot="long_answer"]');
  await expect(slot).toHaveAttribute("data-state", "folded");
  await page.getByRole("button", { name: "Show more" }).click();
  await expect(slot).toHaveAttribute("data-state", "open");
  await slot.evaluate((element) => element.scrollIntoView({ block: "start" }));
  await slot.evaluate((element) => {
    let root = element.parentElement;
    while (root && !/(auto|scroll|overlay)/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
    if (root) root.scrollTop += root.clientHeight * 0.4;
  });
  const coverage = await chatCoverage(slot);
  expect(coverage.coversList, JSON.stringify(coverage)).toBe(true);
  expect(coverage.coversWindow, JSON.stringify(coverage)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.chatSeenEvents.filter((event) => event.name === "component_seen" && event.slot === "long_answer" && event.default_state === "open").length), { timeout: 6500 }).toBe(1);
  await expect(page.getByRole("heading", { name: "New chat" })).toBeInViewport();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeInViewport();
});

test("an open long answer in the desktop chat is seen against the message list", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const id = "550e8400-e29b-41d4-a716-446655440050";
  const messages = [{ id: "assistant-1", role: "assistant", content: `Long answer.\n\n${"A long paragraph remains in the chat viewport. ".repeat(520)}` }];
  await page.route("**/api/conversations", (route) => route.fulfill({ json: [{ id, title: "New chat" }] }));
  await page.route(`**/api/conversations/${id}`, (route) => route.fulfill({ json: { id, title: "New chat", messages } }));
  await stubQuota(page);
  await page.goto("/tests/browser/chat-seen-fixture.html");
  const slot = page.locator('[data-slot="long_answer"]');
  await page.getByRole("button", { name: "Show more" }).click();
  await expect(slot).toHaveAttribute("data-state", "open");
  await slot.evaluate((element) => element.scrollIntoView({ block: "start" }));
  await slot.evaluate((element) => {
    let root = element.parentElement;
    while (root && !/(auto|scroll|overlay)/.test(getComputedStyle(root).overflowY)) root = root.parentElement;
    if (root) root.scrollTop += root.clientHeight * 0.4;
  });
  const coverage = await chatCoverage(slot);
  expect(coverage.coversList, JSON.stringify(coverage)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.chatSeenEvents.filter((event) => event.name === "component_seen" && event.slot === "long_answer" && event.default_state === "open").length), { timeout: 6500 }).toBe(1);
});

test("mobile navigation leaves the chat and its first and last actions reachable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  let count = 0;
  const streamServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" });
    response.write([
      { type: "start", messageId: "assistant-1" },
      { type: "text-start", id: "text-1" },
      { type: "text-delta", id: "text-1", delta: "Streaming answer" },
    ].map((part) => `data: ${JSON.stringify(part)}\n\n`).join(""));
  });
  await new Promise<void>((resolve) => streamServer.listen(0, "127.0.0.1", resolve));
  const streamAddress = streamServer.address();
  if (!streamAddress || typeof streamAddress === "string") throw new Error("Test stream server did not start");
  const ids = Array.from({ length: 12 }, (_, index) => `550e8400-e29b-41d4-a716-${String(index + 1).padStart(12, "0")}`);
  await page.route("**/api/conversations", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ json: { id: ids[0], title: "New chat" } });
      return;
    }
    await route.fulfill({ json: ids.slice(0, count).map((id) => ({ id, title: "New chat" })) });
  });
  await page.route("**/api/conversations/*", (route) => route.fulfill({ json: { id: new URL(route.request().url()).pathname.split("/").at(-1), title: "New chat", messages: [] } }));
  await page.route("**/api/chat", (route) => route.continue({ url: `http://127.0.0.1:${streamAddress.port}/api/chat` }));
  await stubQuota(page);
  await page.goto("/chat.html");
  const firstRun = page.locator("main").getByRole("button", { name: "New chat", exact: true });
  await expect(firstRun).toBeInViewport();
  await firstRun.click();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeInViewport();
  await expect(page.getByRole("heading", { name: "New chat" })).toBeInViewport();

  count = 1;
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeInViewport();
  count = 12;
  await page.reload();
  const nav = page.getByRole("navigation", { name: "Conversations" });
  const chats = nav.getByRole("button", { name: "N New chat" });
  await expect(chats).toHaveCount(12);
  const navigationMetrics = await chats.last().evaluate((element) => {
    const list = element.closest("ul")!;
    list.scrollTop = list.scrollHeight;
    const listRect = list.getBoundingClientRect();
    const itemRect = element.getBoundingClientRect();
    return { listHeight: list.clientHeight, scrollHeight: list.scrollHeight, scrollTop: list.scrollTop, itemFullyVisible: itemRect.top >= listRect.top && itemRect.bottom <= listRect.bottom };
  });
  expect(navigationMetrics.scrollTop).toBeGreaterThan(0);
  expect(navigationMetrics.itemFullyVisible, JSON.stringify(navigationMetrics)).toBe(true);
  await expect(chats.last()).toBeInViewport();
  await chats.last().click();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeInViewport();
  await page.getByRole("textbox", { name: "Message" }).fill("Keep chat reachable");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "New chat" })).toBeInViewport();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeInViewport();
  await page.getByRole("button", { name: "Stop" }).click();
  streamServer.closeAllConnections();
  await new Promise<void>((resolve, reject) => streamServer.close((error) => error ? reject(error) : resolve()));
});

test("mobile navigation keeps the first run, rows, controls, and quota readable in every look", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const ids = Array.from({ length: 12 }, (_, index) => `550e8400-e29b-41d4-a716-${String(index + 1).padStart(12, "0")}`);
  let count = 0;
  await page.route("**/api/conversations", (route) => route.fulfill({ json: route.request().method() === "POST" ? { id: ids[0], title: "New chat" } : ids.slice(0, count).map((id) => ({ id, title: "New chat" })) }));
  await page.route("**/api/conversations/*", (route) => route.fulfill({ json: { id: new URL(route.request().url()).pathname.split("/").at(-1), title: "New chat", messages: [] } }));
  await page.route("**/api/quota", (route) => route.fulfill({ json: { state: "ok", windows: [{ label: "Weekly", used_percent: 28, resets_at: null }, { label: "Daily", used_percent: 82, resets_at: null }], resets_at: null, checked_at: "2026-11-28T00:00:00Z" } }));
  const looks = [defaultLook, focusedLook, notebookLook];
  const applyLook = async (look: typeof defaultLook) => {
    const values = lookTokenValues(look, "light", look.density, String(look.text_size));
    await page.evaluate(({ lookId, values }) => {
      for (const [name, value] of Object.entries(values)) document.documentElement.style.setProperty(name.startsWith("--") ? name : `--${name}`, value);
      document.documentElement.dataset.look = lookId;
    }, { lookId: look.id, values });
  };
  await page.goto("/chat.html");
  const nav = page.getByRole("navigation", { name: "Conversations" });
  for (const look of looks) {
    await applyLook(look);
    const firstRun = nav.getByRole("button", { name: "New chat", exact: true });
    await expect(firstRun).toBeInViewport();
    await expect(page.locator("main").getByRole("button", { name: "New chat", exact: true })).toBeInViewport();
    const navBounds = await nav.boundingBox();
    for (const label of ["Home", "New chat", "Search"]) {
      const bounds = await nav.getByRole("button", { name: label, exact: true }).boundingBox();
      expect(bounds && navBounds && bounds.x >= navBounds.x && bounds.x + bounds.width <= navBounds.x + navBounds.width).toBe(true);
    }
    await expect(nav.getByText(/Quota:/)).toContainText("Weekly: 72% remaining · Daily: 18% remaining");
  }
  await page.locator("main").getByRole("button", { name: "New chat", exact: true }).click();
  const chats = nav.getByRole("button", { name: "N New chat" });
  await expect(chats).toHaveCount(1);
  for (const look of looks) {
    await applyLook(look);
    await expect(chats.first()).toBeInViewport();
    await expect(page.getByRole("heading", { name: "New chat" })).toBeInViewport();
    await expect(page.getByRole("textbox", { name: "Message" })).toBeInViewport();
  }
  count = 12;
  await page.reload();
  for (const look of looks) {
    await applyLook(look);
    const last = nav.getByRole("button", { name: "N New chat" }).last();
    const metrics = await last.evaluate((element) => {
      const list = element.closest("ul")!;
      list.scrollTop = list.scrollHeight;
      const listRect = list.getBoundingClientRect();
      const rowRect = element.getBoundingClientRect();
      return { top: rowRect.top >= listRect.top, bottom: rowRect.bottom <= listRect.bottom, listHeight: list.clientHeight, rowHeight: rowRect.height, listBottom: listRect.bottom, rowBottom: rowRect.bottom };
    });
    expect(metrics, `${look.id}: ${JSON.stringify(metrics)}`).toMatchObject({ top: true, bottom: true });
    await expect(last).toBeInViewport();
  }
});

test("chat rejects pasted and dropped files without clearing the draft", async ({ page }) => {
  const id = "550e8400-e29b-41d4-a716-446655440040";
  const chatBodies: unknown[] = [];
  await page.route("**/api/conversations", (route) => route.fulfill({ json: route.request().method() === "POST" ? { id, title: "New chat" } : [] }));
  await page.route(`**/api/conversations/${id}`, (route) => route.fulfill({ json: { id, title: "New chat", messages: [] } }));
  await page.route("**/api/chat", async (route) => { chatBodies.push(route.request().postDataJSON()); await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }, body: "data: [DONE]\n\n" }); });
  await stubQuota(page);
  await page.goto("/chat.html");
  await page.getByRole("button", { name: "New chat", exact: true }).first().click();
  const input = page.getByRole("textbox", { name: "Message" });
  await input.fill("Keep my draft");
  await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["private sample"], "sample.txt", { type: "text/plain" }));
    document.querySelector("textarea")!.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData: transfer }));
  });
  await expect(input).toHaveValue("Keep my draft");
  await expect(page.getByRole("alert")).toContainText(/attachments are not supported/i);
  await expect(page.getByRole("list", { name: "Selected files" })).toHaveCount(0);
  await page.locator('[aria-label="Message composer"]').dispatchEvent("drop", { dataTransfer: await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["private sample"], "dropped.txt", { type: "text/plain" }));
    return transfer;
  }) });
  await expect(input).toHaveValue("Keep my draft");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(input).toHaveValue("");
  expect(chatBodies).toHaveLength(1);
  expect(JSON.stringify(chatBodies[0])).toContain("Keep my draft");
  expect(JSON.stringify(chatBodies[0])).not.toContain("sample.txt");
  expect(JSON.stringify(chatBodies[0])).not.toContain("dropped.txt");
});

test("chat streams rendered content and reloads stored turns", async ({ page }) => {
  const id = "550e8400-e29b-41d4-a716-446655440000";
  let messages: Array<{ id: string; role: "user" | "assistant"; content: string }> = [];
  const sessionIds: unknown[] = [];
  await page.route("**/api/conversations", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ json: { id, title: "New chat" } });
      return;
    }
    await route.fulfill({ json: messages.length ? [{ id, title: "New chat" }] : [] });
  });
  await page.route(`**/api/conversations/${id}`, (route) => route.fulfill({ json: { id, title: "New chat", messages } }));
  await stubQuota(page);
  await page.route("**/api/chat", async (route) => {
    const request = route.request().postDataJSON();
    sessionIds.push(request.session_id);
    const userText = request.messages.at(-1).parts[0].text as string;
    messages = [
      ...messages,
      { id: `user-${messages.length}`, role: "user", content: userText },
      { id: "assistant-1", role: "assistant", content: '```python\nprint("hello")\n```\n\n| Item | State |\n| --- | --- |\n| Chat | Ready |' },
    ];
    const stream = [
      { type: "start", messageId: "assistant-1" },
      { type: "text-start", id: "text-1" },
      { type: "text-delta", id: "text-1", delta: '```python\nprint("hello")\n```\n\n| Item | State |\n| --- | --- |\n| Chat | Ready |' },
      { type: "text-end", id: "text-1" },
      { type: "finish" },
    ].map((part) => `data: ${JSON.stringify(part)}\n\n`).join("") + "data: [DONE]\n\n";
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }, body: stream });
  });

  await page.goto("/chat.html");
  await page.getByRole("button", { name: "New chat", exact: true }).first().click();
  await page.getByRole("textbox", { name: "Message" }).fill("Show me a table");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText('print("hello")')).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText("Chat", { exact: true })).toBeVisible();
  await expect(page.getByText("Quota: Weekly: 72% remaining")).toBeVisible();
  expect(sessionIds[0]).toMatch(/^[0-9a-f-]{36}$/i);
  const sessionId = sessionIds[0];

  await page.reload();
  await expect(page.getByText("Show me a table", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("implicity.current_session_id"))).toBe(sessionId);
  const rotatedSessionId = "550e8400-e29b-41d4-a716-446655440123";
  await page.evaluate((id) => sessionStorage.setItem("implicity.current_session_id", id), rotatedSessionId);
  await page.getByRole("textbox", { name: "Message" }).fill("One more turn");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect.poll(() => sessionIds.length).toBe(2);
  expect(sessionIds[1]).toBe(rotatedSessionId);
});

test("long streamed answers stay open until reload, then fold by whole blocks", async ({ page }) => {
  const id = "550e8400-e29b-41d4-a716-446655440002";
  const content = `First paragraph ${"a".repeat(1300)}.\n\nSecond paragraph ${"b".repeat(1300)}.`;
  let messages: Array<{ id: string; role: "user" | "assistant"; content: string }> = [];
  await page.route("**/api/conversations", (route) => route.fulfill({ json: route.request().method() === "POST" ? { id, title: "New chat" } : messages.length ? [{ id, title: "New chat" }] : [] }));
  await page.route(`**/api/conversations/${id}`, (route) => route.fulfill({ json: { id, title: "New chat", messages } }));
  await stubQuota(page);
  await page.route("**/api/chat", async (route) => {
    messages = [
      { id: "user-1", role: "user", content: "Give me a long answer" },
      { id: "assistant-1", role: "assistant", content },
    ];
    const stream = [
      { type: "start", messageId: "assistant-1" },
      { type: "text-start", id: "text-1" },
      { type: "text-delta", id: "text-1", delta: content },
      { type: "text-end", id: "text-1" },
      { type: "finish" },
    ].map((part) => `data: ${JSON.stringify(part)}\n\n`).join("") + "data: [DONE]\n\n";
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }, body: stream });
  });

  await page.goto("/chat.html");
  await page.getByRole("button", { name: "New chat", exact: true }).first().click();
  await page.getByRole("textbox", { name: "Message" }).fill("Give me a long answer");
  await page.getByRole("button", { name: "Submit" }).click();
  const slot = page.locator('[data-slot="long_answer"]');
  await expect(slot).toHaveAttribute("data-state", "open");
  await expect(slot).toContainText("Second paragraph");

  await page.reload();
  const restored = page.locator('[data-slot="long_answer"]');
  await expect(restored).toHaveAttribute("data-state", "folded");
  await expect(restored).toContainText("First paragraph");
  await expect(restored).not.toContainText("Second paragraph");
  await page.getByRole("navigation", { name: "Conversations" }).getByRole("button", { name: "N New chat" }).click();
  await expect(page.locator('[data-slot="long_answer"]')).toHaveAttribute("data-state", "folded");
  await page.getByRole("button", { name: "Show more" }).click();
  await expect(page.locator('[data-slot="long_answer"]')).toContainText("Second paragraph");
});

test("a stopped long answer stays open and folds when loaded from storage", async ({ page }) => {
  const id = "550e8400-e29b-41d4-a716-446655440003";
  const content = `First paragraph ${"a".repeat(1300)}.\n\nSecond paragraph ${"b".repeat(1300)}.`;
  let messages: Array<{ id: string; role: "user" | "assistant"; content: string }> = [];
  const server = createServer((_request, response) => {
    messages = [{ id: "assistant-1", role: "assistant", content }];
    response.writeHead(200, { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" });
    response.write([
      { type: "start", messageId: "assistant-1" },
      { type: "text-start", id: "text-1" },
      { type: "text-delta", id: "text-1", delta: content },
    ].map((part) => `data: ${JSON.stringify(part)}\n\n`).join(""));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test stream server did not start");
  await page.route("**/api/conversations", (route) => route.fulfill({ json: route.request().method() === "POST" ? { id, title: "New chat" } : messages.length ? [{ id, title: "New chat" }] : [] }));
  await page.route(`**/api/conversations/${id}`, (route) => route.fulfill({ json: { id, title: "New chat", messages } }));
  await stubQuota(page);
  await page.route("**/api/chat", (route) => route.continue({ url: `http://127.0.0.1:${address.port}/api/chat` }));
  try {
    await page.goto("/chat.html");
    await page.getByRole("button", { name: "New chat", exact: true }).first().click();
    await page.getByRole("textbox", { name: "Message" }).fill("Start a long answer");
    await page.getByRole("button", { name: "Submit" }).click();
    const slot = page.locator('[data-slot="long_answer"]');
    await expect(slot).toHaveAttribute("data-state", "open");
    await expect(slot).toContainText("Second paragraph");
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByRole("button", { name: "Stop" })).toHaveCount(0);
    await expect(slot).toHaveAttribute("data-state", "open");
    await page.reload();
    const restored = page.locator('[data-slot="long_answer"]');
    await expect(restored).toHaveAttribute("data-state", "folded");
    await expect(restored).not.toContainText("Second paragraph");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Stop closes the streaming request and leaves only the received answer", async ({ page }) => {
  const id = "550e8400-e29b-41d4-a716-446655440001";
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" });
    response.write([
      { type: "start", messageId: "assistant-1" },
      { type: "text-start", id: "text-1" },
      { type: "text-delta", id: "text-1", delta: "Partial answer" },
    ].map((part) => `data: ${JSON.stringify(part)}\n\n`).join(""));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test stream server did not start");
  const disconnected = new Promise<void>((resolve) => server.once("close", resolve));
  let responseClosed!: () => void;
  const responseDisconnected = new Promise<void>((resolve) => { responseClosed = resolve; });
  server.on("request", (_request, response) => response.once("close", responseClosed));

  await page.route("**/api/conversations", (route) => route.fulfill({ json: route.request().method() === "POST" ? { id, title: "New chat" } : [] }));
  await page.route(`**/api/conversations/${id}`, (route) => route.fulfill({ json: { id, title: "New chat", messages: [] } }));
  await stubQuota(page);
  await page.route("**/api/chat", (route) => route.continue({ url: `http://127.0.0.1:${address.port}/api/chat` }));
  try {
    await page.goto("/chat.html");
    await page.getByRole("button", { name: "New chat", exact: true }).first().click();
    await page.getByRole("textbox", { name: "Message" }).fill("Start a long answer");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Partial answer")).toBeVisible();
    await page.getByRole("button", { name: "Stop" }).click();
    await responseDisconnected;
    await expect(page.getByText("Partial answer")).toBeVisible();
    await expect(page.getByRole("button", { name: "Stop" })).toHaveCount(0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await disconnected;
  }
});

test("chat keeps an empty and long conversation usable at desktop and phone sizes", async ({ page }) => {
  const id = "550e8400-e29b-41d4-a716-446655440004";
  const answer = `First paragraph ${"a".repeat(1300)}.\n\nSecond paragraph ${"b".repeat(1300)}.`;
  const storedMessages = Array.from({ length: 6 }, (_, index) => [
    { id: `user-${index}`, role: "user" as const, content: `Question ${index + 1}` },
    { id: `answer-${index}`, role: "assistant" as const, content: answer },
  ]).flat();
  let showLong = false;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("**/api/conversations", (route) => route.fulfill({ json: route.request().method() === "POST" ? { id, title: "New chat" } : showLong ? [{ id, title: "New chat" }] : [] }));
  await page.route(`**/api/conversations/${id}`, (route) => route.fulfill({ json: { id, title: "New chat", messages: showLong ? storedMessages : [] } }));
  await stubQuota(page);
  let liveResponse: import("node:http").ServerResponse | undefined;
  let requestCount = 0;
  let announceStream!: () => void;
  const streamStarted = new Promise<void>((resolve) => { announceStream = resolve; });
  const server = createServer((_request, response) => {
    requestCount += 1;
    liveResponse = response;
    response.writeHead(200, { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" });
    response.write([
      { type: "start", messageId: "live-answer" },
      { type: "text-start", id: "live-text" },
      { type: "text-delta", id: "live-text", delta: "Still working" },
    ].map((part) => `data: ${JSON.stringify(part)}\n\n`).join(""));
    announceStream();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test stream server did not start");
  await page.route("**/api/chat", (route) => route.continue({ url: `http://127.0.0.1:${address.port}/api/chat` }));
  try {
    await page.goto("/chat.html");
    await page.getByRole("navigation", { name: "Conversations" }).getByRole("button", { name: "New chat", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Message" })).toBeInViewport();
    await expect(page.getByRole("region", { name: "Message composer" }).getByRole("button", { name: "New chat" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add attachment" })).toHaveCount(0);

    showLong = true;
    await page.reload();
    const messageScroller = page.getByRole("list", { name: "Conversation messages" }).locator("xpath=..");
    await expect.poll(() => messageScroller.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(80);
    await page.getByRole("button", { name: "Show more" }).first().click();
    await page.getByRole("textbox", { name: "Message" }).fill("Continue the discussion");
    await page.getByRole("button", { name: "Submit" }).click();
    const stop = page.getByRole("button", { name: "Stop" });
    await expect(stop).toBeInViewport();
    await expect(page.getByText("Still working")).toBeVisible();
    await streamStarted;
    const textbox = page.getByRole("textbox", { name: "Message" });
    await textbox.fill("Draft while the answer streams");
    await textbox.press("Enter");
    await expect(textbox).toHaveValue("Draft while the answer streams");
    expect(requestCount).toBe(1);
    await expect(page.locator("[data-chat-shell] .overflow-y-auto")).toHaveCount(1);
    await messageScroller.evaluate((element) => { element.scrollTop = 0; });
    liveResponse!.write(`data: ${JSON.stringify({ type: "text-delta", id: "live-text", delta: " while scrolled up" })}\n\n`);
    await expect(page.getByText("while scrolled up")).toBeVisible();
    expect(await messageScroller.evaluate((element) => element.scrollTop)).toBe(0);
    await messageScroller.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    liveResponse!.write(`data: ${JSON.stringify({ type: "text-delta", id: "live-text", delta: " while following" })}\n\n`);
    await expect(page.getByText("while following")).toBeVisible();
    await expect.poll(() => messageScroller.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(80);
    await expect(page.getByRole("textbox", { name: "Message" })).toBeInViewport();
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole("textbox", { name: "Message" })).toBeInViewport();
    await expect(stop).toBeInViewport();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
    const background = await page.locator("#root .bg-background").first().evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(background).not.toBe("rgb(255, 255, 255)");
    await page.evaluate(() => { document.scrollingElement!.scrollTop = document.scrollingElement!.scrollHeight; });
    await expect(page.getByRole("textbox", { name: "Message" })).toBeInViewport();
    await stop.click();
    await expect(stop).toHaveCount(0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("a failed limited send explains the reset and leaves no Stop control", async ({ page }) => {
  const id = "550e8400-e29b-41d4-a716-446655440005";
  let quotaReads = 0;
  await page.route("**/api/conversations", (route) => route.fulfill({ json: route.request().method() === "POST" ? { id, title: "New chat" } : [] }));
  await page.route(`**/api/conversations/${id}`, (route) => route.fulfill({ json: { id, title: "New chat", messages: [] } }));
  await page.route("**/api/quota", (route) => {
    quotaReads += 1;
    const limited = quotaReads > 1;
    return route.fulfill({ json: { state: limited ? "limited" : "unknown", windows: [], resets_at: limited ? "2026-12-01T00:00:00Z" : null, checked_at: "2026-11-28T00:00:00Z" } });
  });
  await page.route("**/api/chat", (route) => route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
    body: [
      { type: "error", errorText: "The agent could not finish this turn." },
      { type: "finish" },
    ].map((part) => `data: ${JSON.stringify(part)}\n\n`).join("") + "data: [DONE]\n\n",
  }));
  await page.goto("/chat.html");
  await page.getByRole("button", { name: "New chat", exact: true }).first().click();
  await page.getByRole("textbox", { name: "Message" }).fill("Please continue");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("alert")).toContainText("usage limit is reached");
  await expect(page.getByRole("alert")).toContainText("resets");
  await expect(page.getByRole("button", { name: "Stop" })).toHaveCount(0);
});

test("quota refreshes after a successful turn without reloading", async ({ page }) => {
  const id = "550e8400-e29b-41d4-a716-446655440006";
  let quotaReads = 0;
  await page.route("**/api/conversations", (route) => route.fulfill({ json: route.request().method() === "POST" ? { id, title: "New chat" } : [] }));
  await page.route(`**/api/conversations/${id}`, (route) => route.fulfill({ json: { id, title: "New chat", messages: [] } }));
  await page.route("**/api/quota", (route) => {
    quotaReads += 1;
    return route.fulfill({ json: { state: quotaReads === 1 ? "unknown" : "ok", windows: quotaReads === 1 ? [] : [{ label: "Weekly", used_percent: 28, resets_at: "2026-12-01T00:00:00Z" }], resets_at: null, checked_at: "2026-11-28T00:00:00Z" } });
  });
  await page.route("**/api/chat", (route) => route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
    body: [
      { type: "start", messageId: "assistant" },
      { type: "text-start", id: "text" },
      { type: "text-delta", id: "text", delta: "Answer" },
      { type: "text-end", id: "text" },
      { type: "finish" },
    ].map((part) => `data: ${JSON.stringify(part)}\n\n`).join("") + "data: [DONE]\n\n",
  }));
  await page.goto("/chat.html");
  await expect(page.getByText("Quota: Unknown")).toBeVisible();
  await page.getByRole("button", { name: "New chat", exact: true }).first().click();
  await page.getByRole("textbox", { name: "Message" }).fill("Hello");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Quota: Weekly: 72% remaining")).toBeVisible();
  expect(quotaReads).toBeGreaterThanOrEqual(2);
});

test("separate assistant text items keep their markdown boundaries after reload", async ({ page }) => {
  const id = "550e8400-e29b-41d4-a716-446655440007";
  const answer = "Let me check.\n\n```python\nprint(2)\n```";
  let messages: Array<{ id: string; role: "user" | "assistant"; content: string }> = [];
  await page.route("**/api/conversations", (route) => route.fulfill({ json: route.request().method() === "POST" ? { id, title: "New chat" } : messages.length ? [{ id, title: "New chat" }] : [] }));
  await page.route(`**/api/conversations/${id}`, (route) => route.fulfill({ json: { id, title: "New chat", messages } }));
  await stubQuota(page);
  await page.route("**/api/chat", (route) => {
    messages = [
      { id: "user", role: "user", content: "Check this" },
      { id: "assistant", role: "assistant", content: answer },
    ];
    const parts = [
      { type: "start", messageId: "assistant" },
      { type: "text-start", id: "first" },
      { type: "text-delta", id: "first", delta: "Let me check." },
      { type: "text-end", id: "first" },
      { type: "text-start", id: "second" },
      { type: "text-delta", id: "second", delta: "```python\nprint(2)\n```" },
      { type: "text-end", id: "second" },
      { type: "finish" },
    ];
    return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }, body: parts.map((part) => `data: ${JSON.stringify(part)}\n\n`).join("") + "data: [DONE]\n\n" });
  });
  await page.goto("/chat.html");
  await page.getByRole("button", { name: "New chat", exact: true }).first().click();
  await page.getByRole("textbox", { name: "Message" }).fill("Check this");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("python · code")).toBeVisible();
  await expect(page.getByText("print(2)")).toBeVisible();
  await page.reload();
  await expect(page.getByText("python · code")).toBeVisible();
  await expect(page.getByText("print(2)")).toBeVisible();
});
