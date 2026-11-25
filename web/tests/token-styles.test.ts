import { describe, expect, it } from "vitest";
import { paths, tokenStyleViolations } from "../scripts/check-token-styles.mjs";
import { token } from "../src/registry/token";
import { tokenNames } from "../src/registry/token-values.mjs";

const componentFile = new URL("../src/registry/Probe/Probe.tsx", import.meta.url).pathname;
const rendererFile = new URL("../src/renderer.tsx", import.meta.url).pathname;
const galleryFile = new URL("../src/gallery.tsx", import.meta.url).pathname;
const previewRuntimeFile = new URL("../src/preview-runtime.tsx", import.meta.url).pathname;
const previewMainFile = new URL("../src/preview-main.tsx", import.meta.url).pathname;
const tokenImport = 'import { token } from "../token"; ';

describe("token-only style guard", () => {
  it("scans both preview runtime files", () => {
    expect(paths).toContain(previewRuntimeFile);
    expect(paths).toContain(previewMainFile);
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
    expect(tokenStyleViolations(`${tokenImport}export function Probe({ children }: { children: string }) { return <section className="text-primary bg-background rounded-md p-4 font-sans flex grid items-center justify-between" style={{ color: token("--foreground") }}>{children}</section>; }`, componentFile)).toEqual([]);
    expect(tokenStyleViolations('const View = () => <div style={{ color: "var(--foreground)", display: "none" }} />;', componentFile)).toEqual([]);
    expect(tokenStyleViolations('.text { color: var(--foreground); display: none; }', "styles.css")).toEqual([]);
    expect(token("--foreground")).toBe("var(--foreground)");
    expect(token("text-primary")).toBe("text-primary");
    expect(() => token("text-red-500")).toThrow(/Unknown design token/);
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
    expect(tokenNames.has("--code-background")).toBe(false);
  });
});
