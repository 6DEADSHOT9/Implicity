import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import config from "../../vite.config";

describe("Vite capture environment", () => {
  it("reads VITE_POSTHOG settings from the repository-root .env", () => {
    expect(resolve(fileURLToPath(new URL("../../", import.meta.url)), config.envDir)).toBe(resolve(fileURLToPath(new URL("../../../", import.meta.url))));
  });
});
