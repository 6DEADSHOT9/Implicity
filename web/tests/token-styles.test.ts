import { describe, expect, it } from "vitest";
import { tokenStyleViolations } from "../scripts/check-token-styles.mjs";

describe("token-only style guard", () => {
  it.each([
    ['const View = () => <div style={{ color: "#ff0000" }} />;', "color"],
    ['const View = () => <div style={{ backgroundColor: "rebeccapurple" }} />;', "backgroundColor"],
    ['const View = () => <div style={{ fontSize: 19 }} />;', "fontSize"],
    ['const View = () => <div style={{ fontFamily: "Arial" }} />;', "fontFamily"],
    ['const styles = { letterSpacing: "1px" };', "letterSpacing"],
    ['const View = () => <div className="text-red-500 text-[19px] font-serif" />;', "text-red-500"],
    ['const View = () => <div className="gap-4" />;', "gap-4"],
  ])("rejects %s", (source, violation) => {
    expect(tokenStyleViolations(source).some((message) => message.includes(violation))).toBe(true);
  });

  it("allows semantic Token references", () => {
    expect(tokenStyleViolations('const View = () => <div style={{ color: "var(--foreground)" }} />;')).toEqual([]);
    expect(tokenStyleViolations('const styles = { fontFamily: "var(--font-body)" };', "styles.ts")).toEqual([]);
    expect(tokenStyleViolations(".text { font-family: var(--font-body); color: var(--foreground); }", "styles.css")).toEqual([]);
  });

  it("parses CSS style declarations and rejects alternate fixed values", () => {
    expect(tokenStyleViolations(".text { color: rebeccapurple; letter-spacing: 1px; font-family: Arial; }", "styles.css")).toHaveLength(3);
  });
});
