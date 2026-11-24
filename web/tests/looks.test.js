import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const fontsDirectory = realpathSync(resolve(root, "web/public/fonts"));
const tokenSet = JSON.parse(readFileSync(resolve(root, "contracts/looks/tokens.json"), "utf8"));
const looks = readdirSync(resolve(root, "contracts/looks"))
  .filter((file) => file.endsWith(".json") && file !== "tokens.json")
  .map((file) => JSON.parse(readFileSync(resolve(root, "contracts/looks", file), "utf8")));
const shadcnColorKeys = [
  "background", "foreground", "card", "card-foreground", "popover", "popover-foreground",
  "primary", "primary-foreground", "secondary", "secondary-foreground", "muted",
  "muted-foreground", "accent", "accent-foreground", "destructive", "destructive-foreground",
  "border", "input", "ring", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
  "sidebar", "sidebar-foreground", "sidebar-primary", "sidebar-primary-foreground",
  "sidebar-accent", "sidebar-accent-foreground", "sidebar-border", "sidebar-ring",
];
const requiredTextPairs = [
  ["foreground", "background"], ["card-foreground", "card"], ["popover-foreground", "popover"],
  ["primary-foreground", "primary"], ["secondary-foreground", "secondary"],
  ["muted-foreground", "muted"], ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"], ["sidebar-foreground", "sidebar"],
  ["sidebar-primary-foreground", "sidebar-primary"], ["sidebar-accent-foreground", "sidebar-accent"],
  ...["code-foreground", "code-comment", "code-keyword", "code-string", "code-number", "code-function", "code-type", "code-operator"]
    .map((foreground) => [foreground, "code-background"]),
  ...["terminal-foreground", "terminal-success", "terminal-warning", "terminal-error", "terminal-info", "terminal-prompt"]
    .map((foreground) => [foreground, "terminal-background"]),
];
const rootKeys = ["id", "name", "typeface", "radius", "density", "text_size", "texture", "motion", "light", "dark"];
const lookIds = ["default", "focused", "notebook"];
const typefaceRoles = ["body", "heading"];

function luminance(color) {
  if (!/^#[\da-f]{6}$/i.test(color)) throw new Error(`Expected opaque six-digit hex color: ${color}`);
  const channels = color.slice(1).match(/.{2}/g).map((part) => parseInt(part, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function cssDeclarations(block) {
  return Object.fromEntries([...block.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
}

function resolveFontUrl(url) {
  expect(url).toMatch(/^\/fonts\//);
  const path = realpathSync(resolve(root, "web/public", `.${url}`));
  const fromFonts = relative(fontsDirectory, path);
  expect(fromFonts).not.toBe("..");
  expect(fromFonts.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)).toBe(false);
  expect(isAbsolute(fromFonts)).toBe(false);
  expect(statSync(path).isFile()).toBe(true);
  return path;
}

describe("look contracts", () => {
  it("matches the documented shape and defines the full shadcn palette in each mode", () => {
    expect(looks.map((look) => look.id).sort()).toEqual(lookIds);
    expect(tokenSet.colorKeys).toEqual(expect.arrayContaining(shadcnColorKeys));
    for (const look of looks) {
      expect(Object.keys(look).sort()).toEqual([...rootKeys].sort());
      expect(Object.keys(look.typeface).sort()).toEqual(typefaceRoles);
      for (const role of typefaceRoles) expect(tokenSet.typefaces[look.typeface[role]]).toBeDefined();
      expect(["square", "small", "medium", "round"]).toContain(look.radius);
      expect(["compact", "comfortable", "spacious"]).toContain(look.density);
      expect(look.text_size).toBeGreaterThanOrEqual(1);
      expect(look.text_size).toBeLessThanOrEqual(5);
      expect(Number.isInteger(look.text_size)).toBe(true);
      expect(["none", "paper-grain", "ruled-lines"]).toContain(look.texture);
      expect(["none", "subtle", "full"]).toContain(look.motion);
      expect(tokenSet.derivedTokens.radius[look.radius]).toBeDefined();
      expect(tokenSet.derivedTokens.density[look.density]).toBeDefined();
      expect(tokenSet.derivedTokens.textSize[String(look.text_size)]).toBeDefined();
      for (const mode of ["light", "dark"]) {
        expect(Object.keys(look[mode]).sort()).toEqual([...tokenSet.colorKeys].sort());
        for (const [foreground, background] of requiredTextPairs) {
          expect(contrast(look[mode][foreground], look[mode][background])).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(look[mode].input, look[mode].background)).toBeGreaterThanOrEqual(3);
        expect(contrast(look[mode].input, look[mode].card)).toBeGreaterThanOrEqual(3);
        for (const color of Object.values(look[mode])) expect(color).toMatch(/^#[\da-f]{6}$/i);
        expect(new Set(Object.values(look[mode])).size).toBeLessThanOrEqual(tokenSet.quality.maximumPaletteColors);
      }
    }
  });

  it("uses the WCAG sRGB contrast boundary and rejects alpha or malformed colors", () => {
    expect(contrast("#737373", "#faf9f6")).toBeCloseTo(4.503644, 5);
    expect(contrast("#737373", "#faf9f6")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#808080", "#17191c")).toBeCloseTo(4.459804, 5);
    expect(contrast("#808080", "#17191c")).toBeLessThan(4.5);
    expect(() => contrast("#29282400", "#faf9f6")).toThrow();
    expect(() => contrast("rgb(0 0 0)", "#ffffff")).toThrow();
  });

  it("defines valid token scales, minimum targets and component dimensions", () => {
    expect(tokenSet.quality.textContrast).toBe(4.5);
    expect(tokenSet.quality.nonTextContrast).toBe(3);
    expect(tokenSet.quality.minimumTarget).toBe("2.75rem");
    expect(tokenSet.quality.maximumLineLength).toBe("80ch");
    expect(tokenSet.quality.maximumPaletteColors).toBeGreaterThanOrEqual(8);
    expect(tokenSet.requiredTextPairs).toEqual(requiredTextPairs);
    expect(Object.keys(tokenSet.derivedTokens.radius.medium).sort()).toEqual([
      "--radius", "--radius-full", "--radius-lg", "--radius-md", "--radius-sm",
    ]);
    expect(tokenSet.derivedTokens.fontWeights["--font-weight-normal"]).toBe("400");
    expect(tokenSet.derivedTokens.fontWeights["--font-weight-medium"]).toBe("500");
    expect(tokenSet.derivedTokens.fontWeights["--font-weight-semibold"]).toBe("600");
    expect(tokenSet.derivedTokens.fontWeights["--font-weight-bold"]).toBe("700");
    expect(tokenSet.derivedTokens.lineHeights["--line-height-body"]).toBe("1.5");
    expect(tokenSet.derivedTokens.lineHeights["--line-height-heading"]).toBe("1.2");
    expect(tokenSet.derivedTokens.lineHeights["--line-height-code"]).toBe("1.5");
    for (const density of Object.values(tokenSet.derivedTokens.density)) {
      expect(parseFloat(density["--target-min-size"])).toBeGreaterThanOrEqual(2.75);
      expect(parseFloat(density["--control-height"])).toBeGreaterThanOrEqual(2.75);
      const spacing = Object.keys(density).filter((key) => key.startsWith("--space-"));
      expect(spacing).toHaveLength(6);
      const spacingValues = spacing.map((key) => parseFloat(density[key]));
      expect(spacingValues).toEqual([...spacingValues].sort((a, b) => a - b));
      expect(spacingValues.every((value) => Number.isInteger(value / 0.125))).toBe(true);
    }
    for (const dimension of ["--sidebar-width", "--sidebar-width-mobile", "--panel-width", "--panel-min-width", "--panel-max-width", "--sheet-width", "--media-control-size", "--media-control-gap", "--media-track-height", "--content-max-width"]) {
      expect(tokenSet.derivedTokens.dimensions[dimension]).toBeTruthy();
    }
    const dimensions = tokenSet.derivedTokens.dimensions;
    expect(parseFloat(dimensions["--panel-min-width"]))
      .toBeLessThanOrEqual(parseFloat(dimensions["--panel-width"]));
    expect(parseFloat(dimensions["--panel-width"]))
      .toBeLessThanOrEqual(parseFloat(dimensions["--panel-max-width"]));
    expect(parseFloat(dimensions["--media-control-size"]))
      .toBeGreaterThanOrEqual(parseFloat(tokenSet.quality.minimumTarget));
    expect(dimensions["--content-max-width"]).toMatch(/^\d+ch$/);
    const headings = Object.values(tokenSet.derivedTokens.textSize["3"].headings);
    expect(headings).toHaveLength(6);
    const headingSizes = headings.map((value) => parseFloat(value));
    expect(headingSizes).toEqual([...headingSizes].sort((a, b) => b - a));
    expect(new Set(headingSizes).size).toBe(headingSizes.length);
    expect(parseFloat(tokenSet.derivedTokens.dimensions["--content-max-width"]))
      .toBeLessThanOrEqual(parseFloat(tokenSet.quality.maximumLineLength));
    for (const scale of Object.values(tokenSet.derivedTokens.textSize)) {
      expect(Math.min(...Object.values(scale.sizes).map((value) => parseFloat(value))))
        .toBeGreaterThanOrEqual(parseFloat(tokenSet.quality.minimumText));
    }
  });

  it("resolves selected and declared font sources to bundled files only", () => {
    expect(Object.keys(tokenSet.typefaces).sort()).toEqual(["informal", "mono", "sans", "serif"]);
    const css = readFileSync(resolve(root, "web/src/tokens.css"), "utf8");
    expect(css).not.toMatch(/@import/i);
    const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/gi)].map((match) => cssDeclarations(match[1]));
    expect(faces).toHaveLength(4);
    const expectedWeights = { Inter: "100 900", "IBM Plex Mono": "400", "Source Serif 4": "200 900", Caveat: "400 700" };
    const faceByFamily = new Map();
    for (const face of faces) {
      expect(face["font-family"]).toBeTruthy();
      expect(face.src).toBeTruthy();
      const family = face["font-family"].replaceAll(/["']/g, "");
      expect(face["font-weight"]).toBe(expectedWeights[family]);
      const urls = [...face.src.matchAll(/url\(["']?([^"')]+)["']?\)/gi)].map((match) => match[1]);
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) resolveFontUrl(url);
      expect(face.src).not.toMatch(/https?:|\/\//i);
      faceByFamily.set(family, { ...face, urls });
    }
    for (const [key, face] of Object.entries(tokenSet.typefaces)) {
      expect(faceByFamily.has(face.family)).toBe(true);
      const declaration = faceByFamily.get(face.family);
      expect(declaration.urls).toContain(face.url);
      const asset = resolveFontUrl(face.url);
      const mappedFile = realpathSync(resolve(fontsDirectory, face.file));
      expect(mappedFile).toBe(asset);
      expect(relative(fontsDirectory, mappedFile).startsWith("..")).toBe(false);
      for (const look of looks) {
        for (const role of typefaceRoles) {
          if (look.typeface[role] === key) expect(declaration["font-family"].replaceAll(/["']/g, "")).toBe(face.family);
        }
      }
    }
  });
});
