import { renderToStaticMarkup } from "react-dom/server";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import textBlockSchema from "../../contracts/generated/components/TextBlock.schema.json";
import { baselineLayout, getSkeleton, registry, registryVersion } from "../src/registry";
import { renderMessage, resolveLayout } from "../src/renderer";

const validText = {
  registry_version: registryVersion,
  root: "answer",
  elements: { answer: { type: "TextBlock", props: { text: "Hello" } } },
};

describe("registry and renderer", () => {
  it("exposes reviewed skeleton metadata and fixed ids", () => {
    const text = getSkeleton("TextBlock");
    expect(text?.meta.role).toBe("content");
    expect(text?.meta.slots).toEqual([]);
    expect(text?.meta.defaultStates).toEqual(["plain"]);
    expect(text?.meta.commands).toEqual([]);
    expect(getSkeleton("Unknown")).toBeUndefined();
    expect(Object.keys(registry)).toEqual(["TextBlock"]);
  });

  it("exports the Skeleton schema as JSON Schema", () => {
    const validate = new Ajv2020({ strict: false }).compile(textBlockSchema);
    expect(validate({ props: { text: "Hello" }, slots: {} })).toBe(true);
    expect(validate({ props: { text: "Hello" }, slots: { undeclared: [] } })).toBe(false);
  });

  it("renders valid specs through json-render using only registered skeletons", () => {
    expect(renderToStaticMarkup(renderMessage(validText, "fallback"))).toContain("Hello");
    expect(renderToStaticMarkup(renderMessage({ ...validText, elements: { answer: { type: "Unknown", props: {} } } }, "plain answer"))).toContain("plain answer");
    expect(renderToStaticMarkup(renderMessage({ ...validText, elements: { answer: { type: "TextBlock", props: { text: 42 } } } }, "plain answer"))).toContain("plain answer");
  });

  it("uses the last valid layout, then the baseline", () => {
    const lastGood = { ...validText, elements: { answer: { type: "TextBlock", props: { text: "last good" } } } };
    const invalid = { ...validText, elements: { answer: { type: "Unknown", props: {} } } };
    expect(resolveLayout(invalid, lastGood)).toEqual(lastGood);
    expect(resolveLayout(invalid, invalid)).toEqual(baselineLayout);
  });
});
