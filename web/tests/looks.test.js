import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const tokenSet = JSON.parse(readFileSync(resolve(root, "contracts/looks/tokens.json"), "utf8"));
const looks = readdirSync(resolve(root, "contracts/looks"))
  .filter((file) => file.endsWith(".json") && file !== "tokens.json")
  .map((file) => JSON.parse(readFileSync(resolve(root, "contracts/looks", file), "utf8")));

function luminance(color) {
  const [r, g, b] = color.match(/[\da-f]{2}/gi).map((part) => parseInt(part, 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("look contracts", () => {
  it("defines every token in light and dark variants and keeps text contrast at WCAG AA", () => {
    expect(looks.map((look) => look.id).sort()).toEqual(["default", "focused", "notebook"]);
    for (const look of looks) {
      for (const mode of ["light", "dark"]) {
        const variant = look[mode];
        expect(Object.keys(variant).sort()).toEqual(Object.keys(tokenSet.tokens).sort());
        for (const [foreground, background] of tokenSet.textPairs) {
          expect(contrast(variant[foreground], variant[background])).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("resolves all four typefaces to bundled local files and serves them locally", () => {
    expect(Object.keys(tokenSet.typefaces).sort()).toEqual(["informal", "mono", "sans", "serif"]);
    const css = readFileSync(resolve(root, "web/src/tokens.css"), "utf8");
    for (const path of Object.values(tokenSet.typefaces)) {
      const font = resolve(root, path);
      expect(font.startsWith(resolve(root, "web/public/fonts"))).toBe(true);
      expect(statSync(font).isFile()).toBe(true);
      expect(css).toContain(`url("/${path.replace("web/public/", "")}")`);
    }
  });
});
