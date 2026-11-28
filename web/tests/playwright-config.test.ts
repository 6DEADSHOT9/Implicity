import { expect, it } from "vitest";
import config from "../playwright.config";

it("starts both browser test servers with V8 fast API calls disabled", () => {
  const servers = [config.webServer ?? []].flat();
  expect(servers).toHaveLength(2);
  for (const { command } of servers) {
    expect(command).toMatch(/^node --no-turbo-fast-api-calls /);
  }
});
