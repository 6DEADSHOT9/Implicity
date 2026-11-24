// @vitest-environment jsdom
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import Ajv2020 from "ajv/dist/2020.js";
import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRegistry, defineSkeleton, getSkeleton, registry as emptyRegistry } from "../src/registry";
import { baselineLayout, renderLayout, renderMessage, resolveLayout } from "../src/renderer";
import { events } from "./fixtures/ReviewPanel/events";
import { meta } from "./fixtures/ReviewPanel/meta";
import { ReviewPanelEntry } from "./fixtures/ReviewPanel/entry";
import { ReviewPanel } from "./fixtures/ReviewPanel/ReviewPanel";
import { propsSchema } from "./fixtures/ReviewPanel/schema";
import { ReviewShellEntry } from "./fixtures/ReviewShell/entry";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const panelRegistry = createRegistry([ReviewPanelEntry], 1);
const goodLayout = {
  registry_version: 1,
  root: "panel",
  elements: { panel: { type: "ReviewPanel", props: { count: 8 }, slots: { main: [] } } },
};

async function markup(element: ReactElement): Promise<string> {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(element));
  const html = container.innerHTML;
  await act(async () => root.unmount());
  return html;
}

afterEach(() => vi.restoreAllMocks());

describe("registry and renderer", () => {
  it("uses own registry keys and exposes fixed ids to callers", () => {
    expect(panelRegistry.getSkeleton("ReviewPanel")).toBe(ReviewPanelEntry);
    expect(panelRegistry.getSkeleton("ReviewPanel")?.meta.slots).toEqual(["main"]);
    expect(panelRegistry.getSkeleton("ReviewPanel")?.meta.defaultStates).toEqual(["plain"]);
    expect(panelRegistry.getSkeleton("ReviewPanel")?.meta.commands).toEqual([]);
    expect(panelRegistry.getSkeleton("ReviewPanel")?.events).toEqual(["component_shown", "component_seen"]);
    expect(panelRegistry.getSkeleton("constructor")).toBeUndefined();
    expect(getSkeleton("constructor")).toBeUndefined();
    expect(emptyRegistry.entries.size).toBe(0);
  });

  it("derives json-render components and named slots from the entry", async () => {
    const spec = {
      registry_version: 1,
      root: "panel",
      elements: {
        panel: { type: "ReviewPanel", props: { count: 7 }, slots: { main: ["child"] } },
        child: { type: "ReviewPanel", props: { count: 3 }, slots: { main: [] } },
      },
    };
    expect(await markup(renderMessage(spec, "fallback", panelRegistry))).toContain("<strong>7</strong><section><strong>3</strong></section>");
  });

  it("falls back for inherited, unknown and missing-root component ids", async () => {
    expect(await markup(renderMessage({ ...goodLayout, elements: { panel: { type: "constructor", props: {} } } }, "plain answer", panelRegistry))).toContain("plain answer");
    expect(await markup(renderMessage({ ...goodLayout, root: "constructor", elements: {} }, "plain answer", panelRegistry))).toContain("plain answer");
    expect(resolveLayout({ ...goodLayout, elements: { panel: { type: "constructor", props: {} } } }, goodLayout, panelRegistry)).toEqual(goodLayout);
    expect(resolveLayout({ ...goodLayout, root: "constructor", elements: {} }, goodLayout, panelRegistry)).toEqual(goodLayout);
    expect(resolveLayout({ ...goodLayout, elements: { panel: { type: "ReviewPanel", props: { count: 7 }, slots: { main: ["constructor"] } } } }, goodLayout, panelRegistry)).toEqual(goodLayout);
    const invalid = { ...goodLayout, elements: { panel: { type: "constructor", props: {} } } };
    expect(resolveLayout(invalid, invalid, panelRegistry)).toEqual(baselineLayout);
    expect(await markup(renderLayout(invalid, invalid, panelRegistry))).toContain("Workspace unavailable");
    const shellRegistry = createRegistry([ReviewPanelEntry, ReviewShellEntry], 2);
    expect(resolveLayout(invalid, invalid, shellRegistry).root).toBe("shell");
    const shellFallback = await markup(renderLayout(invalid, invalid, shellRegistry));
    expect(shellFallback).toContain("<main>");
    expect(shellFallback).toContain("Workspace unavailable");
    expect(await markup(renderLayout({ ...goodLayout, elements: { panel: { type: "ReviewPanel", props: { count: 7 }, slots: { undeclared: [] } } } }, goodLayout, panelRegistry))).toContain("<strong>8</strong>");
  });

  it("uses T3 shape checks and the complete entry schema while replacing only invalid message components", async () => {
    const missingProps = {
      registry_version: 1,
      root: "panel",
      elements: {
        panel: { type: "ReviewPanel", props: { count: 7 }, slots: { main: ["child"] } },
        child: { type: "ReviewPanel", slots: { main: [] } },
      },
    };
    expect(await markup(renderMessage(missingProps, "plain answer", panelRegistry))).toContain("<strong>7</strong><p");
    expect(await markup(renderMessage(missingProps, "plain answer", panelRegistry))).toContain("plain answer");
    const invalidRef = { ...goodLayout, elements: { panel: { type: "ReviewPanel", props: { count: 7 }, slots: { main: ["constructor"] } } } };
    expect(await markup(renderMessage(invalidRef, "plain answer", panelRegistry))).toContain("plain answer");
    const invalidId = { ...goodLayout, elements: { panel: { type: "ReviewPanel", props: { count: 7 }, slots: { main: ["Child"] } } } };
    expect(await markup(renderMessage(invalidId, "plain answer", panelRegistry))).toContain("plain answer");
    expect(resolveLayout(invalidId, goodLayout, panelRegistry)).toEqual(goodLayout);

    const jsonSchema = ReviewPanelEntry.schema.toJSONSchema();
    const validate = new Ajv2020({ strict: false }).compile(jsonSchema);
    expect(validate({ props: { count: 1 }, slots: {} })).toBe(false);
    expect(validate({ props: { count: 1 }, slots: { main: ["child"] } })).toBe(true);
    expect(validate({ props: { count: 1 } })).toBe(false);
    expect(validate({ props: { count: 1 }, slots: { main: ["Child"] } })).toBe(false);
    expect(validate({ props: { count: "1" }, slots: {} })).toBe(false);
    expect(validate({ props: { count: 1, unlisted: true }, slots: {} })).toBe(false);
    expect(validate({ props: { count: 1 }, slots: { unlisted: [] } })).toBe(false);
    expect(await markup(renderMessage(goodLayout, "fallback", panelRegistry))).toContain("<strong>8</strong>");
    const missingSlot = { ...goodLayout, elements: { panel: { type: "ReviewPanel", props: { count: 8 } } } };
    expect(await markup(renderMessage(missingSlot, "fallback", panelRegistry))).toContain("fallback");
    expect(resolveLayout(missingSlot, undefined, panelRegistry)).toEqual(baselineLayout);
    expect(await markup(renderMessage({ ...goodLayout, elements: { panel: { type: "ReviewPanel", props: { count: 8 }, slots: { main: [] } } } }, "fallback", panelRegistry))).toContain("<strong>8</strong>");
  });

  it("falls back from a throwing message component in place", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const spec = {
      registry_version: 1,
      root: "panel",
      elements: {
        panel: { type: "ReviewPanel", props: { count: 7 }, slots: { main: ["child"] } },
        child: { type: "ReviewPanel", props: { count: 2, fail: true } },
      },
    };
    expect(await markup(renderMessage(spec, "plain answer", panelRegistry))).toContain("<strong>7</strong><p");
    expect(await markup(renderMessage(spec, "plain answer", panelRegistry))).toContain("plain answer");
  });

  it("keeps valid older layouts and recovers when a rendered layout throws", async () => {
    const newerRegistry = createRegistry([ReviewPanelEntry], 2);
    const oldLayout = { ...goodLayout, registry_version: 1 };
    expect(resolveLayout(oldLayout, undefined, newerRegistry)).toEqual(oldLayout);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = { ...goodLayout, elements: { panel: { type: "ReviewPanel", props: { count: 4, fail: true }, slots: { main: [] } } } };
    expect(await markup(renderLayout(broken, oldLayout, newerRegistry))).toContain("<strong>8</strong>");
    expect(await markup(renderLayout(broken, broken, newerRegistry))).toContain("Workspace unavailable");
    const shellRegistry = createRegistry([ReviewPanelEntry, ReviewShellEntry], 2);
    expect(await markup(renderLayout(broken, broken, shellRegistry))).toContain("<main>");
  });

  it("rejects entries missing declarations, invalid ids, events or reviewed limits", () => {
    expect(() => createRegistry([{ ...ReviewPanelEntry, events: undefined } as never], 1)).toThrow(/events/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, slots: undefined } } as never], 1)).toThrow(/slots/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, limits: { minWidth: 0, minHeight: 0 } } } as never], 1)).toThrow(/minContrast/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, galleryStates: undefined } } as never], 1)).toThrow(/galleryStates/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, defaultStates: undefined } } as never], 1)).toThrow(/defaultStates/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, commands: undefined } } as never], 1)).toThrow(/commands/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, commands: ["bad command"] } } as never], 1)).toThrow(/Command/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, commands: ["cmd_123"] } } as never], 1)).toThrow(/cmd_/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, events: ["made_up_event"] }], 1)).toThrow(/event/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, events: ["component_shown"] }], 1)).toThrow(/shown and seen/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, slots: [] } } as never], 1)).toThrow(/slot/);
    const weakSlotEntry = defineSkeleton({
      id: ReviewPanelEntry.id,
      props: propsSchema,
      slots: z.object({ main: z.array(z.string()).optional() }).strict(),
      events,
      meta,
      Component: ReviewPanel,
    });
    expect(() => createRegistry([weakSlotEntry], 1)).toThrow(/T3 child ids/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, defaultStates: ["bad state"] } }], 1)).toThrow(/default state id/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, galleryStates: ["bad state"] } }], 1)).toThrow(/gallery state id/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, id: "bad id" }], 1)).toThrow(/component id/);
  });
});
