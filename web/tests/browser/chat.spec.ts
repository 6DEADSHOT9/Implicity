import { expect, test } from "@playwright/test";
import { createServer } from "node:http";

async function stubQuota(page: import("@playwright/test").Page) {
  await page.route("**/api/quota", (route) => route.fulfill({ json: {
    state: "ok",
    windows: [{ label: "Weekly", used_percent: 28, resets_at: "2026-12-01T00:00:00Z" }],
    resets_at: null,
    checked_at: "2026-11-28T00:00:00Z",
  } }));
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

test("chat streams rendered content and reloads stored turns", async ({ page }) => {
  const id = "550e8400-e29b-41d4-a716-446655440000";
  let messages: Array<{ id: string; role: "user" | "assistant"; content: string }> = [];
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

  await page.reload();
  await expect(page.getByText("Show me a table", { exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
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
