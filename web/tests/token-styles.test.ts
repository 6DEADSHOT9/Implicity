import { describe, expect, it } from "vitest";
import { tokenStyleViolations } from "../scripts/check-token-styles.mjs";
import { token } from "../src/registry/token";

const componentFile = "/workspace/web/src/registry/Probe/Probe.tsx";
const tokenImport = 'import { token } from "../token"; ';

describe("token-only style guard", () => {
  it.each([
    ['const View = () => <div style={{ color: "#ff0000" }} />;', "color"],
    ['const View = () => <div style={{ backgroundColor: "rebeccapurple" }} />;', "backgroundColor"],
    ['const View = () => <div style={{ fontSize: "19px" }} />;', "fontSize"],
    ['const View = () => <div className="text-red-500" />;', "text-red-500"],
    ['const View = () => <div className={"text-red-500"} />;', "text-red-500"],
    ['const shade = "red"; const View = () => <div className={"text-" + shade + "-500"} />;', "unsupported dynamic className"],
    ['const shade = "red"; const View = () => <div className={`text-${shade}-500`} />;', "unsupported dynamic className"],
    ['const View = () => <div className="hover:text-red-500" />;', "hover:text-red-500"],
    ['const color = "rebeccapurple"; const appearance = { color }; const View = () => <div style={appearance} />;', "rebeccapurple"],
    ['const base = { color: "rebeccapurple" }; const appearance = { ...base }; const View = () => <div style={appearance} />;', "rebeccapurple"],
    ['const appearance = { className: "text-red-500", style: { color: "rebeccapurple" } }; const View = () => <div {...appearance} />;', "text-red-500"],
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

  it("rejects dynamic token names and non-token CSS values", () => {
    expect(tokenStyleViolations(`${tokenImport}const name = "--foreground"; const View = () => <div style={{ color: token(name) }} />;`, componentFile)).toContain("unsupported dynamic style value for color");
    expect(tokenStyleViolations('.text { color: rebeccapurple; letter-spacing: 1px; font-family: Arial; }', "styles.css")).toHaveLength(3);
  });
});
