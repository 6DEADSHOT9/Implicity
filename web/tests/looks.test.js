import { readFileSync, readdirSync, realpathSync, statSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
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
const fontDigests = {
  Caveat: "0bdb6b660482d31531b3945849fba5916b3ef8695da7024a9e6b9ee3c4157988",
  "IBM Plex Mono": "6a3412f058c7d8dfd9170c41e85ade48e5156ecb89356110ca57a0a27734af46",
  Inter: "29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031",
  "Source Serif 4": "97b2d4da6e3cb494b5a1e66ae176914d852ccabef49e0c02c0df25f3e39aca0b",
};

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

function assertFontFile(path, family) {
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
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(fontDigests[family]);
}

function resolveFontUrl(url, family) {
  expect(url).toMatch(/^\/fonts\//);
  const path = realpathSync(resolve(root, "web/public", `.${url}`));
  const fromFonts = relative(fontsDirectory, path);
  expect(fromFonts).not.toBe("..");
  expect(fromFonts.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)).toBe(false);
  expect(isAbsolute(fromFonts)).toBe(false);
  expect(statSync(path).isFile()).toBe(true);
  assertFontFile(path, family);
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
  return urls;
}

function parseFontStylesheet(css) {
  const stylesheet = postcss.parse(css, { from: "tokens.css" });
  expect(stylesheet.nodes.filter((node) => node.type === "atrule" && node.name.toLowerCase() === "import")
    .every((node) => node.params === '"tailwindcss"')).toBe(true);
  expect(stylesheet.nodes.every((node) => node.type === "comment" ||
    (node.type === "atrule" && ["import", "custom-variant", "theme", "utility", "font-face"].includes(node.name.toLowerCase())))).toBe(true);
  const nodes = stylesheet.nodes.filter((node) => node.type === "atrule" && node.name.toLowerCase() === "font-face");
  expect(nodes).toHaveLength(4);
  const faces = [];
  for (const rule of nodes) {
    expect(rule.type).toBe("atrule");
    expect(rule.name.toLowerCase()).toBe("font-face");
    expect(rule.nodes.every((node) => node.type === "decl" || node.type === "comment")).toBe(true);
    const declarations = rule.nodes.filter((node) => node.type === "decl");
    expect(declarations.every((declaration) => ["font-family", "src", "font-weight", "font-style", "font-display"].includes(declaration.prop.toLowerCase()))).toBe(true);
    const familyDeclarations = declarations.filter((declaration) => declaration.prop.toLowerCase() === "font-family");
    const sourceDeclarations = declarations.filter((declaration) => declaration.prop.toLowerCase() === "src");
    const weightDeclarations = declarations.filter((declaration) => declaration.prop.toLowerCase() === "font-weight");
    const styleDeclarations = declarations.filter((declaration) => declaration.prop.toLowerCase() === "font-style");
    const displayDeclarations = declarations.filter((declaration) => declaration.prop.toLowerCase() === "font-display");
    expect(familyDeclarations).toHaveLength(1);
    expect(sourceDeclarations).toHaveLength(1);
    expect(weightDeclarations).toHaveLength(1);
    expect(styleDeclarations).toHaveLength(1);
    expect(displayDeclarations).toHaveLength(1);
    const family = familyDeclarations[0].value
      .replace(/^(["'])(.*)\1$/, "$2");
    expect(family).toBeTruthy();
    faces.push({ family, declarations, urls: sourceUrls(sourceDeclarations[0].value) });
  }
  return faces;
}

function validateFontStylesheet(css) {
  const faces = parseFontStylesheet(css);
  const expectedWeights = { Inter: "100 900", "IBM Plex Mono": "400", "Source Serif 4": "200 900", Caveat: "400 700" };
  const expectedFamilies = Object.values(tokenSet.typefaces).map((face) => face.family).sort();
  expect(faces.map((face) => face.family).sort()).toEqual(expectedFamilies);
  for (const [key, manifest] of Object.entries(tokenSet.typefaces)) {
    const face = faces.find((item) => item.family === manifest.family);
    expect(face.urls).toEqual([manifest.url]);
    const weight = face.declarations.find((declaration) => declaration.prop.toLowerCase() === "font-weight").value;
    expect(weight).toBe(expectedWeights[manifest.family]);
    expect(realpathSync(resolve(fontsDirectory, manifest.file))).toBe(resolveFontUrl(manifest.url, manifest.family));
    for (const look of looks) {
      for (const role of typefaceRoles) {
        if (look.typeface[role] === key) expect(face.family).toBe(manifest.family);
      }
    }
  }
}

function distinctColorCount(colors) {
  return new Set(colors.map((color) => color.toLowerCase())).size;
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
        expect(distinctColorCount(palette)).toBeLessThanOrEqual(tokenSet.quality.maximumPaletteColors);
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
    expect(distinctColorCount(["#f2f3f5", "#F2F3F5"])).toBe(1);
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
    expect(tokenSet.derivedTokens.fontWeights).toEqual({
      "--font-weight-normal": "400", "--font-weight-medium": "500",
      "--font-weight-semibold": "600", "--font-weight-bold": "700",
    });
    for (const weight of Object.values(tokenSet.derivedTokens.fontWeights)) {
      expect(["100", "200", "300", "400", "500", "600", "700", "800", "900"]).toContain(weight);
    }
    expect(tokenSet.derivedTokens.lineHeights).toEqual({
      "--line-height-body": "1.5", "--line-height-heading": "1.2", "--line-height-code": "1.5",
    });
    for (const lineHeight of Object.values(tokenSet.derivedTokens.lineHeights)) {
      expect(Number.isFinite(Number(lineHeight)) && Number(lineHeight) > 0).toBe(true);
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
    const dimensionKeys = ["--attachment-preview-size", "--attachment-thumbnail-size", "--border-width", "--content-max-height", "--content-max-width", "--content-min-height", "--focus-ring-width", "--icon-size", "--media-control-gap", "--media-control-size", "--media-track-height", "--panel-max-width", "--panel-min-width", "--panel-width", "--sheet-width", "--sidebar-width", "--sidebar-width-icon", "--sidebar-width-mobile"].sort();
    const dimensions = tokenSet.derivedTokens.dimensions;
    expect(Object.keys(dimensions).sort()).toEqual(dimensionKeys);
    for (const key of dimensionKeys) {
      cssLength(dimensions[key], [key === "--sheet-width" ? "vw" : key === "--content-max-width" ? "ch" : "rem", "px"]);
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
    validateFontStylesheet(css);
    for (const escapedImport of [
      `${css}\n@i\\6dport url("https://fonts.invalid/review-fixture.css");`,
      `${css}\n@imp\\6frt url("https://fonts.invalid/review-fixture.css");`,
    ]) expect(() => validateFontStylesheet(escapedImport)).toThrow();
    expect(() => validateFontStylesheet(`${css}\n@import url("https://fonts.invalid/fonts.css");`)).toThrow();
    expect(() => validateFontStylesheet(css.replace(
      '  font-display: swap;\n}',
      '  src: url("https://fonts.invalid/review-fixture.woff2") format("woff2")\n}',
    ))).toThrow();
    expect(() => validateFontStylesheet(css.replace(
      "  font-family: Inter;",
      '  font-family: Inter;\n  font-family: "Unbundled Review Family";',
    ))).toThrow();
    expect(() => validateFontStylesheet(css.replace(
      '  src: url("/fonts/inter/Inter.ttf") format("truetype");',
      '  src: url("/fonts/inter/Inter.ttf") format("truetype");\n  src: url("/fonts/ibm-plex-mono/IBMPlexMono.ttf") format("truetype");',
    ))).toThrow();
    expect(() => validateFontStylesheet(css.replace(
      '  font-weight: 100 900;',
      '  font-weight: 100 900;\n  font-weight: 400;',
    ))).toThrow();
    expect(() => validateFontStylesheet(css.replace(
      'url("/fonts/inter/Inter.ttf")',
      'url("/fonts/ibm-plex-mono/IBMPlexMono.ttf")',
    ))).toThrow();
    const tempDirectory = mkdtempSync(join(tmpdir(), "implicity-empty-font-"));
    try {
      const emptyFont = join(tempDirectory, "empty.ttf");
      writeFileSync(emptyFont, Buffer.alloc(0));
      expect(() => assertFontFile(emptyFont, "Inter")).toThrow();
      const corruptFont = join(tempDirectory, "corrupt.ttf");
      const corruptBytes = Buffer.alloc(29);
      corruptBytes.write("\u0000\u0001\u0000\u0000", 0, "binary");
      corruptBytes.writeUInt16BE(1, 4);
      corruptBytes.write("test", 12);
      corruptBytes.writeUInt32BE(28, 20);
      corruptBytes.writeUInt32BE(1, 24);
      writeFileSync(corruptFont, corruptBytes);
      expect(() => assertFontFile(corruptFont, "Inter")).toThrow();
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});
