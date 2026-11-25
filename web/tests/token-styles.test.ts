import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import webPackage from "../package.json" with { type: "json" };
import tokens from "../../contracts/looks/tokens.json" with { type: "json" };
import { missingTailwindRules, paths, tokenStyleViolations } from "../scripts/check-token-styles.mjs";
import { token } from "../src/registry/token";
import { tokenNames } from "../src/registry/token-values.mjs";

const componentFile = fileURLToPath(new URL("../src/registry/Probe/Probe.tsx", import.meta.url));
const rendererFile = fileURLToPath(new URL("../src/renderer.tsx", import.meta.url));
const galleryFile = fileURLToPath(new URL("../src/gallery.tsx", import.meta.url));
const primitiveGalleryFile = fileURLToPath(new URL("../src/components/primitive-gallery.tsx", import.meta.url));
const previewRuntimeFile = fileURLToPath(new URL("../src/preview-runtime.tsx", import.meta.url));
const previewMainFile = fileURLToPath(new URL("../src/preview-main.tsx", import.meta.url));
const primitiveFile = fileURLToPath(new URL("../src/components/ui/Probe.tsx", import.meta.url));
const tokenImport = 'import { token } from "../token"; ';

describe("token-only style guard", () => {
  it("scans both preview runtime files", () => {
    expect(paths).toContain(previewRuntimeFile);
    expect(paths).toContain(previewMainFile);
  });

  it("scans copied shadcn and AI Elements source folders", () => {
    expect(paths.some((path) => path.includes("/components/ui/"))).toBe(true);
    expect(paths.some((path) => path.includes("/components/ai-elements/"))).toBe(true);
  });

  it("scans the primitive gallery and rejects hard-coded colors there", () => {
    expect(paths).toContain(primitiveGalleryFile);
    expect(tokenStyleViolations('const View = () => <div style={{ color: "#f00" }} />;', primitiveGalleryFile)).toContain("color: #f00");
  });

  it("rejects unknown and arbitrary primitive utilities and hard-coded inline styles", () => {
    expect(tokenStyleViolations('const Probe = () => <div className="bg-not-a-token" />;', primitiveFile)).toContain("unknown or non-token style utility: bg-not-a-token");
    expect(tokenStyleViolations('const Probe = () => <div className="bg-[#f00]" />;', primitiveFile)).toContain("arbitrary style utility is not allowed: bg-[#f00]");
    expect(tokenStyleViolations('const Probe = () => <div style={{ color: "#f00" }} />;', primitiveFile)).toContain("color: #f00");
    expect(tokenStyleViolations('const Probe = () => <div style={{ color: "var(--foreground)" }} />;', primitiveFile)).toEqual([]);
  });

  it("checks primitive classes against Tailwind's generated rules", () => {
    expect(missingTailwindRules(["bg-background", "@md:flex", "banana-split"])).toEqual(["banana-split"]);
  });

  it("keeps static query thresholds aligned with the design tokens", () => {
    const css = readFileSync(new URL("../src/tokens.css", import.meta.url), "utf8");
    for (const size of ["sm", "md", "lg", "xl"]) {
      expect(css).toContain(`--breakpoint-${size}: ${tokens.derivedTokens.dimensions[`--screen-${size}` as keyof typeof tokens.derivedTokens.dimensions]};`);
      expect(css).toContain(`--container-${size}: ${tokens.derivedTokens.dimensions[`--container-size-${size}` as keyof typeof tokens.derivedTokens.dimensions]};`);
    }
  });

  it("keeps release-age guarded packages pinned and removes unused theme and highlighting packages", () => {
    expect(webPackage.dependencies["lucide-react"]).toBe("1.73.0");
    expect(webPackage.dependencies["react-resizable-panels"]).toBe("4.24.1");
    expect(webPackage.dependencies["tw-animate-css"]).toBe("1.4.0");
    expect("next-themes" in webPackage.dependencies).toBe(false);
    expect("@streamdown/code" in webPackage.dependencies).toBe(false);
    expect("@streamdown/math" in webPackage.dependencies).toBe(false);
    expect("@streamdown/mermaid" in webPackage.dependencies).toBe(false);
    const workspace = readFileSync(new URL("../../pnpm-workspace.yaml", import.meta.url), "utf8");
    expect(workspace).not.toContain("minimumReleaseAgeExclude");
  });

  it.each(["border", "border-0", "ring-2", "ring-4", "ring-0", "z-9999", "duration-500", "rotate-45", "top-12", "w-px"])("rejects hard-coded utility %s", (utility) => {
    expect(tokenStyleViolations(`const Probe = () => <div className="${utility}" />;`, primitiveFile).length).toBeGreaterThan(0);
  });

  it.each([
    ['const View = () => <div style={{ color: "#ff0000" }} />;', "color"],
    ['const View = () => <div style={{ backgroundColor: "rebeccapurple" }} />;', "backgroundColor"],
    ['const View = () => <div style={{ fontSize: "19px" }} />;', "fontSize"],
    ['const View = () => <div style={{ color: "center" }} />;', "color"],
    ['const View = () => <div style={{ width: "center" }} />;', "width"],
    ['const View = () => <div style={{ background: "flex" }} />;', "background"],
    ['const View = () => <div style={{ fontFamily: "column" }} />;', "fontFamily"],
    ['const View = () => <div style={{ padding: "wrap" }} />;', "padding"],
    ['const View = () => <div style={{ borderRadius: "baseline" }} />;', "borderRadius"],
    ['const View = () => <div style={{ boxShadow: "space-between" }} />;', "boxShadow"],
    ['const View = () => <div className="text-red-500" />;', "text-red-500"],
    ['const View = () => <div className={"text-red-500"} />;', "text-red-500"],
    ['const shade = "red"; const View = () => <div className={"text-" + shade + "-500"} />;', "unsupported dynamic className"],
    ['const shade = "red"; const View = () => <div className={`text-${shade}-500`} />;', "unsupported dynamic className"],
    ['const View = () => <div className="hover:text-red-500" />;', "hover:text-red-500"],
    ['const color = "rebeccapurple"; const appearance = { color }; const View = () => <div style={appearance} />;', "rebeccapurple"],
    ['const base = { color: "rebeccapurple" }; const appearance = { ...base }; const View = () => <div style={appearance} />;', "rebeccapurple"],
    ['const appearance = { className: "text-red-500", style: { color: "rebeccapurple" } }; const View = () => <div {...appearance} />;', "text-red-500"],
    ['const appearance = { "className": "text-red-500", "style": { color: "rebeccapurple" } }; const View = () => <div {...appearance} />;', "text-red-500"],
    ['const appearance = { ["style"]: { color: "rebeccapurple" } }; const View = () => <div {...appearance} />;', "unsupported JSX spread member"],
    ['const appearance = { color: "rebeccapurple" }; const View = () => <div style={appearance} />;', "rebeccapurple"],
    ['import { appearance } from "./appearance"; const View = () => <div style={appearance} />;', "unsupported dynamic style object"],
    ['import { appearance } from "./appearance"; const View = () => <div {...appearance} />;', "unsupported dynamic JSX spread"],
    ['const appearance = getAppearance(); const View = () => <div style={appearance} />;', "unsupported dynamic style object"],
    ['const View = ({ dark }: { dark: boolean }) => <div style={{ color: dark ? "var(--foreground)" : "var(--background)" }} />;', "unsupported style value"],
  ])("rejects unsafe source %s", (source, violation) => {
    expect(tokenStyleViolations(source, componentFile).some((message) => message.includes(violation))).toBe(true);
  });

  it("allows a token-styled Skeleton and layout utilities", () => {
    expect(tokenStyleViolations(`${tokenImport}export function Probe({ children }: { children: string }) { return <section className="text-primary bg-background rounded-md p-space-4 font-sans flex grid items-center justify-between" style={{ color: token("--foreground") }}>{children}</section>; }`, componentFile)).toEqual([]);
    expect(tokenStyleViolations('const View = () => <div style={{ color: "var(--foreground)", display: "none" }} />;', componentFile)).toEqual([]);
    expect(tokenStyleViolations('.text { color: var(--foreground); display: none; }', "styles.css")).toEqual([]);
    expect(token("--foreground")).toBe("var(--foreground)");
    expect(token("text-primary")).toBe("text-primary");
    expect(() => token("text-red-500")).toThrow(/Unknown design token/);
  });

  it("checks every static class in cn and cva variants", () => {
    const source = 'import { cn } from "cn"; import { cva } from "class-variance-authority"; const variants = cva("flex bg-primary", { variants: { tone: { danger: "text-destructive", bad: "bg-red-500" } } }); const View = ({ className }: { className?: string }) => <div className={cn(variants({ tone: "danger" }), "p-space-4", className)} />;';
    expect(tokenStyleViolations(source, componentFile)).toContain("unknown or non-token style utility: bg-red-500");
    expect(tokenStyleViolations(source.replace(', bad: "bg-red-500"', ""), componentFile)).toEqual([]);
  });

  it("allows gallery classes only in the gallery and layout keywords only in layout properties", () => {
    expect(tokenStyleViolations('const View = () => <div className="gallery-control" />;', componentFile).some((message) => message.includes("gallery-control"))).toBe(true);
    expect(tokenStyleViolations('const View = () => <div className="gallery-control" />;', rendererFile).some((message) => message.includes("gallery-control"))).toBe(true);
    expect(tokenStyleViolations('const View = () => <div className="gallery-control" />;', galleryFile)).toEqual([]);
    expect(tokenStyleViolations('const View = () => <div style={{ display: "flex", alignItems: "center" }} />;', componentFile)).toEqual([]);
    expect(tokenStyleViolations('const View = () => <div style={{ width: "var(--gallery-device-width)" }} />;', componentFile)).toContain("width: var(--gallery-device-width)");
    expect(tokenStyleViolations('const View = () => <div style={{ width: "var(--gallery-device-width)" }} />;', rendererFile)).toContain("width: var(--gallery-device-width)");
    expect(tokenStyleViolations('const View = () => <p style={{ color: "#f00" }} />;', previewRuntimeFile)).toContain("color: #f00");
    expect(tokenStyleViolations('const View = () => <p style={{ color: "#f00" }} />;', previewMainFile)).toContain("color: #f00");
    expect(tokenStyleViolations('.probe { color: center; width: center; display: flex; }', "styles.css")).toEqual(["color: center", "width: center"]);
    expect(tokenStyleViolations('.probe { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }', fileURLToPath(new URL("../src/gallery.css", import.meta.url)))).toEqual([]);
  });

  it("rejects dynamic token names and non-token CSS values", () => {
    expect(tokenStyleViolations(`${tokenImport}const name = "--foreground"; const View = () => <div style={{ color: token(name) }} />;`, componentFile)).toContain("unsupported dynamic style value for color");
    expect(tokenStyleViolations('.text { color: rebeccapurple; letter-spacing: 1px; font-family: Arial; }', "styles.css")).toHaveLength(3);
  });

  it("trusts only the approved token import binding", () => {
    const alias = 'import { token as designToken } from "../token"; ';
    expect(tokenStyleViolations(`${alias}const View = () => <div style={{ color: designToken("--foreground") }} />;`, componentFile)).toEqual([]);
    expect(tokenStyleViolations(`${alias}function token() { return "rebeccapurple"; } const View = () => <div style={{ color: token("--foreground") }} />;`, componentFile)).toContain("unsupported dynamic style value for color");
    expect(tokenStyleViolations(`${tokenImport}const View = (token: () => string) => <div style={{ color: token() }} />;`, componentFile)).toContain("unsupported dynamic style value for color");
    expect(tokenStyleViolations(`${alias}const View = (designToken: () => string) => <div style={{ color: designToken() }} />;`, componentFile)).toContain("unsupported dynamic style value for color");
    expect(tokenStyleViolations('import { token } from "./fake"; const View = () => <div style={{ color: token("--foreground") }} />;', componentFile)).toContain("unsupported dynamic style value for color");
  });

  it("does not accept custom properties that have no CSS token definition", () => {
    expect(tokenNames.has("--font-body")).toBe(true);
    expect(tokenNames.has("--font-heading")).toBe(true);
    expect(tokenNames.has("--gallery-device-width")).toBe(false);
    expect(tokenNames.has("--code-background")).toBe(true);
  });
});
