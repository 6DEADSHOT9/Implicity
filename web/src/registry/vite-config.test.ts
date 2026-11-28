import { describe, expect, it } from "vitest";
import config from "../../vite.config";

describe("Vite development proxy", () => {
  it("routes API requests to the backend", () => {
    expect(config.server.proxy?.["/api"]).toBeTruthy();
  });
});
