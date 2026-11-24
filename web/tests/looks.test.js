import { readFileSync, readdirSync, realpathSync, statSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import postcss from "postcss";
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
const sharedColorKeys = [
  "code-background", "code-foreground", "code-comment", "code-keyword", "code-string",
  "code-number", "code-function", "code-type", "code-operator", "terminal-background",
  "terminal-foreground", "terminal-success", "terminal-warning", "terminal-error",
  "terminal-info", "terminal-prompt",
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
const lookTextPairs = requiredTextPairs.slice(0, 11);
const sharedTextPairs = requiredTextPairs.slice(11);
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

function cssLength(value, units = ["rem", "px"]) {
  const match = /^(\d+(?:\.\d+)?)(rem|px|ch|vw)$/.exec(value);
  if (!match || !units.includes(match[2])) throw new Error(`Invalid CSS length: ${value}`);
  return { value: Number(match[1]), unit: match[2], pixels: Number(match[1]) * (match[2] === "rem" ? 16 : 1) };
}

function assertFontFile(path) {
  const bytes = readFileSync(path);
  expect(bytes.length).toBeGreaterThanOrEqual(12);
  expect(["\u0000\u0001\u0000\u0000", "OTTO", "true", "typ1"]).toContain(bytes.toString("binary", 0, 4));
  const tableCount = bytes.readUInt16BE(4);
  expect(tableCount).toBeGreaterThan(0);
  expect(bytes.length).toBeGreaterThanOrEqual(12 + tableCount * 16);
  for (let index = 0; index < tableCount; index += 1) {
    const entry = 12 + index * 16;
    expect(bytes.readUInt32BE(entry + 8) + bytes.readUInt32BE(entry + 12)).toBeLessThanOrEqual(bytes.length);
  }
}

function resolveFontUrl(url) {
  expect(url).toMatch(/^\/fonts\//);
  const path = realpathSync(resolve(root, "web/public", `.${url}`));
  const fromFonts = relative(fontsDirectory, path);
  expect(fromFonts).not.toBe("..");
  expect(fromFonts.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)).toBe(false);
  expect(isAbsolute(fromFonts)).toBe(false);
  expect(statSync(path).isFile()).toBe(true);
  assertFontFile(path);
  return path;
}

function sourceUrls(value) {
  const urls = [...value.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)]
    .map((match) => match[1] ?? match[2] ?? match[3].trim());
  expect(urls.length).toBeGreaterThan(0);
  const remainder = value
    .replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*?)\s*\)/gi, "")
    .replace(/(?:format|tech)\(\s*(?:"[^"]*"|'[^']*'|[\w-]+)\s*\)/gi, "")
    .replace(/[\s,]/g, "");
  expect(remainder).toBe("");
  for (const url of urls) resolveFontUrl(url);
  return urls;
}

function parseFontStylesheet(css) {
  const stylesheet = postcss.parse(css, { from: "tokens.css" });
  const imports = [];
  const faces = [];
  stylesheet.walkAtRules((rule) => {
    if (rule.name.toLowerCase() === "import") imports.push(rule);
    if (rule.name.toLowerCase() !== "font-face") return;
    const declarations = rule.nodes.filter((node) => node.type === "decl");
    const family = declarations.find((declaration) => declaration.prop.toLowerCase() === "font-family")?.value
      .replace(/^(["'])(.*)\1$/, "$2");
    const sources = declarations.filter((declaration) => declaration.prop.toLowerCase() === "src");
    expect(family).toBeTruthy();
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) sourceUrls(source.value);
    faces.push({ family, declarations, urls: sources.flatMap((source) => sourceUrls(source.value)) });
  });
  expect(imports).toHaveLength(0);
  return faces;
}

describe("look contracts", () => {
  it("matches the documented shape and exact shadcn color allowlist", () => {
    expect(looks.map((look) => look.id).sort()).toEqual(lookIds);
    expect(tokenSet.colorKeys).toEqual(shadcnColorKeys);
    expect(Object.keys(tokenSet.sharedPalette).sort()).toEqual(["dark", "light"]);
    for (const mode of ["light", "dark"]) {
      const shared = tokenSet.sharedPalette[mode];
      expect(Object.keys(shared).sort()).toEqual([...sharedColorKeys].sort());
      for (const color of Object.values(shared)) expect(color).toMatch(/^#[\da-f]{6}$/i);
      for (const [foreground, background] of sharedTextPairs) {
        expect(contrast(shared[foreground], shared[background])).toBeGreaterThanOrEqual(4.5);
      }
    }
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
        expect(Object.keys(look[mode]).sort()).toEqual([...shadcnColorKeys].sort());
        for (const [foreground, background] of lookTextPairs) {
          expect(contrast(look[mode][foreground], look[mode][background])).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(look[mode].input, look[mode].background)).toBeGreaterThanOrEqual(3);
        expect(contrast(look[mode].input, look[mode].card)).toBeGreaterThanOrEqual(3);
        for (const color of Object.values(look[mode])) expect(color).toMatch(/^#[\da-f]{6}$/i);
        const palette = [...Object.values(look[mode]), ...Object.values(tokenSet.sharedPalette[mode])];
        expect(new Set(palette).size).toBeLessThanOrEqual(tokenSet.quality.maximumPaletteColors);
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

  it("defines complete CSS scales, valid units and safe dimensions", () => {
    expect(Object.keys(tokenSet.derivedTokens.radius).sort()).toEqual(["medium", "round", "small", "square"]);
    const radiusKeys = ["--radius", "--radius-full", "--radius-lg", "--radius-md", "--radius-sm"].sort();
    for (const radius of Object.values(tokenSet.derivedTokens.radius)) {
      expect(Object.keys(radius).sort()).toEqual(radiusKeys);
      for (const key of radiusKeys) cssLength(radius[key], [key === "--radius-full" ? "px" : "rem"]);
    }
    expect(Object.keys(tokenSet.derivedTokens.density).sort()).toEqual(["comfortable", "compact", "spacious"]);
    expect(Object.keys(tokenSet.derivedTokens.textSize).sort()).toEqual(["1", "2", "3", "4", "5"]);
    expect(Object.values(tokenSet.derivedTokens.textSize).map((scale) => scale["--text-scale"]))
      .toEqual(["0.875", "0.9375", "1", "1.125", "1.25"]);
    expect(tokenSet.quality.textContrast).toBe(4.5);
    expect(tokenSet.quality.nonTextContrast).toBe(3);
    expect(tokenSet.quality.minimumTarget).toBe("2.75rem");
    expect(tokenSet.quality.minimumText).toBe("0.875rem");
    expect(tokenSet.quality.maximumLineLength).toBe("80ch");
    expect(tokenSet.quality.maximumPaletteColors).toBe(34);
    expect(tokenSet.quality.spacingUnit).toBe("0.125rem");
    expect(tokenSet.requiredTextPairs).toEqual(requiredTextPairs);
    expect(Object.keys(tokenSet.derivedTokens.radius.medium).sort()).toEqual(radiusKeys);
    for (const key of ["--font-weight-normal", "--font-weight-medium", "--font-weight-semibold", "--font-weight-bold"]) {
      expect(tokenSet.derivedTokens.fontWeights[key]).toBeTruthy();
    }
    for (const key of ["--line-height-body", "--line-height-heading", "--line-height-code"]) {
      expect(tokenSet.derivedTokens.lineHeights[key]).toBeTruthy();
    }
    const minimumTarget = cssLength(tokenSet.quality.minimumTarget).pixels;
    expect(minimumTarget).toBeGreaterThanOrEqual(44);
    const densityKeys = ["--control-height", "--row-gap", "--section-gap", "--target-min-size", ...Array.from({ length: 6 }, (_, index) => `--space-${index + 1}`)].sort();
    for (const density of Object.values(tokenSet.derivedTokens.density)) {
      expect(Object.keys(density).sort()).toEqual(densityKeys);
      const target = cssLength(density["--target-min-size"], ["rem", "px"]).pixels;
      const control = cssLength(density["--control-height"], ["rem", "px"]).pixels;
      expect(target).toBeGreaterThanOrEqual(minimumTarget);
      expect(control).toBeGreaterThanOrEqual(minimumTarget);
      const spacing = Array.from({ length: 6 }, (_, index) => cssLength(density[`--space-${index + 1}`], ["rem"]).pixels);
      expect(spacing.every((value, index) => index === 0 || value > spacing[index - 1])).toBe(true);
      const unit = cssLength(tokenSet.quality.spacingUnit, ["rem"]).pixels;
      expect(spacing.every((value) => Number.isInteger(value / unit))).toBe(true);
      cssLength(density["--row-gap"], ["rem"]);
      cssLength(density["--section-gap"], ["rem"]);
    }
    const dimensionKeys = ["--sidebar-width", "--sidebar-width-mobile", "--panel-width", "--panel-min-width", "--panel-max-width", "--sheet-width", "--media-control-size", "--media-control-gap", "--media-track-height", "--content-max-width"].sort();
    const dimensions = tokenSet.derivedTokens.dimensions;
    expect(Object.keys(dimensions).sort()).toEqual(dimensionKeys);
    for (const key of dimensionKeys) {
      cssLength(dimensions[key], [key === "--sheet-width" ? "vw" : key === "--content-max-width" ? "ch" : "rem"]);
    }
    expect(cssLength(dimensions["--panel-min-width"]).pixels)
      .toBeLessThanOrEqual(cssLength(dimensions["--panel-width"]).pixels);
    expect(cssLength(dimensions["--panel-width"]).pixels)
      .toBeLessThanOrEqual(cssLength(dimensions["--panel-max-width"]).pixels);
    expect(cssLength(dimensions["--media-control-size"]).pixels).toBeGreaterThanOrEqual(minimumTarget);
    expect(cssLength(dimensions["--content-max-width"], ["ch"]).value)
      .toBeLessThanOrEqual(cssLength(tokenSet.quality.maximumLineLength, ["ch"]).value);
    const textKeys = ["--text-base", "--text-lg", "--text-sm", "--text-xl", "--text-xs"].sort();
    const headingKeys = Array.from({ length: 6 }, (_, index) => `--heading-${index + 1}`).sort();
    for (const scale of Object.values(tokenSet.derivedTokens.textSize)) {
      expect(Object.keys(scale).sort()).toEqual(["--text-scale", "headings", "sizes"].sort());
      expect(Object.keys(scale.sizes).sort()).toEqual(textKeys);
      expect(Object.keys(scale.headings).sort()).toEqual(headingKeys);
      const sizes = Object.values(scale.sizes).map((value) => cssLength(value, ["rem"]).pixels);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(cssLength(tokenSet.quality.minimumText).pixels);
      const headings = headingKeys.map((key) => cssLength(scale.headings[key], ["rem"]).pixels);
      expect(headings.every((value, index) => index === 0 || value < headings[index - 1])).toBe(true);
      expect(Math.min(...headings)).toBeGreaterThanOrEqual(cssLength(tokenSet.quality.minimumText).pixels);
    }
  });

  it("parses every font source, resolves selected families and rejects invalid font assets", () => {
    expect(Object.keys(tokenSet.typefaces).sort()).toEqual(["informal", "mono", "sans", "serif"]);
    const css = readFileSync(resolve(root, "web/src/tokens.css"), "utf8");
    const faces = parseFontStylesheet(css);
    expect(faces).toHaveLength(4);
    const expectedWeights = { Inter: "100 900", "IBM Plex Mono": "400", "Source Serif 4": "200 900", Caveat: "400 700" };
    const faceByFamily = new Map();
    for (const face of faces) {
      const weight = face.declarations.find((declaration) => declaration.prop.toLowerCase() === "font-weight")?.value;
      expect(weight).toBe(expectedWeights[face.family]);
      faceByFamily.set(face.family, face);
    }
    expect([...faceByFamily.keys()].sort()).toEqual(Object.values(tokenSet.typefaces).map((face) => face.family).sort());
    for (const [key, face] of Object.entries(tokenSet.typefaces)) {
      const declaration = faceByFamily.get(face.family);
      expect(declaration.urls).toContain(face.url);
      const asset = resolveFontUrl(face.url);
      expect(realpathSync(resolve(fontsDirectory, face.file))).toBe(asset);
      for (const look of looks) {
        for (const role of typefaceRoles) {
          if (look.typeface[role] === key) expect(declaration.family).toBe(face.family);
        }
      }
    }
    const remoteFinalSource = css.replace('  font-display: swap;\n}', '  src: url("https://fonts.invalid/review-fixture.woff2") format("woff2")\n}');
    expect(() => parseFontStylesheet(remoteFinalSource)).toThrow();
    expect(() => parseFontStylesheet(`@import url("https://fonts.invalid/fonts.css");\n${css}`)).toThrow();
    const tempDirectory = mkdtempSync(join(tmpdir(), "implicity-empty-font-"));
    try {
      const emptyFont = join(tempDirectory, "empty.ttf");
      writeFileSync(emptyFont, Buffer.alloc(0));
      expect(() => assertFontFile(emptyFont)).toThrow();
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
