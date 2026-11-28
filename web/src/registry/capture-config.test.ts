import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../vite.config";

describe("Vite capture environment", () => {
  it("reads VITE_POSTHOG settings from the repository-root .env", () => {
    expect(resolve(new URL("../../", import.meta.url).pathname, config.envDir)).toBe(resolve(new URL("../../../", import.meta.url).pathname));
  });
});
