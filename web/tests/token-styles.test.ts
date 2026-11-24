import { describe, expect, it } from "vitest";
import { tokenStyleViolations } from "../scripts/check-token-styles.mjs";

describe("token-only style guard", () => {
  it.each([
    ['style={{ color: "#ff0000" }}', "fixed color"],
    ['style={{ backgroundColor: "red" }}', "named color"],
    ['style={{ fontSize: 19 }}', "fixed size or font"],
    ['style={{ fontFamily: "Arial" }}', "fixed font"],
    ['className="text-red-500 text-[19px] font-serif"', "fixed utility color, size or font"],
    ['className="gap-4"', "fixed utility color, size or font"],
  ])("rejects %s", (source, violation) => {
    expect(tokenStyleViolations(source).some((message) => message.includes(violation))).toBe(true);
  });

  it("allows semantic Token references", () => {
    expect(tokenStyleViolations('style={{ color: "var(--foreground)" }}')).toEqual([]);
  });
});
