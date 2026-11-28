import { expect, it } from "vitest";
import config from "../playwright.config";

it("starts every browser test server with V8 fast API calls disabled", () => {
  const servers = [config.webServer ?? []].flat();
  // The gallery, the gallery built with its capture opt-in (gallery-capture.spec.ts), and the preview build.
  expect(servers).toHaveLength(3);
  for (const { command } of servers) {
    expect(command).toMatch(/^node --no-turbo-fast-api-calls /);
  }
});
