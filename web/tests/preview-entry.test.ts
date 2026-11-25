import { describe, expect, it } from "vitest";
import loader from "../src/preview-entry.ts?raw";
import main from "../src/preview-main.tsx?raw";

describe("production preview loader", () => {
  it("keeps registry modules lazy and out of the preview entry", () => {
    expect(loader.match(/import\.meta\.glob/g)).toHaveLength(5);
    expect(loader).not.toMatch(/eager\s*:\s*true/);
    expect(main).not.toMatch(/from\s+["']\.\/registry(?:\/|["'])/);
  });
});
