// @vitest-environment jsdom
import { act, type ReactElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import Ajv2020 from "ajv/dist/2020.js";
import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRegistry, defineSkeleton, defineSkeletonDefinition, getSkeleton, registry } from "../src/registry";
import { baselineLayout, renderLayout, renderMessage, resolveLayout } from "../src/renderer";
import { events } from "./fixtures/ReviewPanel/events";
import { meta } from "./fixtures/ReviewPanel/meta";
import { ReviewPanelEntry } from "./fixtures/ReviewPanel/entry";
import { ReviewPanel } from "./fixtures/ReviewPanel/ReviewPanel";
import { definition as panelDefinition, propsSchema } from "./fixtures/ReviewPanel/schema";
import { ReviewShellEntry } from "./fixtures/ReviewShell/entry";

const fixedSlotPanel = defineSkeleton(defineSkeletonDefinition({
  id: "ResultsPanel",
  props: z.object({ tabs: z.array(z.object({ id: z.string(), label: z.string() })) }),
  slots: z.object({ main: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)) }),
  events: ["component_shown", "component_seen"],
  meta: {
    role: "content", slots: ["main"], defaultStates: ["default"], commands: [],
    limits: { minWidth: 320, minHeight: 120, minContrast: 4.5 },
    galleryStates: [{ id: "default", props: { tabs: [{ id: "results", label: "Results" }] }, slots: { main: ["results"] } }],
  },
}), ({ slots }: { tabs: { id: string; label: string }[]; slots?: { main?: ReactNode[] } }) => <section>{slots?.main}</section>);

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: true }) });

const panelRegistry = createRegistry([ReviewPanelEntry], 1);
const goodLayout = {
  registry_version: 1,
  root: "panel",
  elements: { panel: { type: "ReviewPanel", props: { count: 8 }, slots: { main: [] } } },
};

export function rejectMismatchedSkeletonProps() {
  const mismatchedSkeleton = ({ label }: { label: string }) => <strong>{label.toUpperCase()}</strong>;
  // @ts-expect-error component props must be supplied by the Skeleton schema
  defineSkeleton(panelDefinition, mismatchedSkeleton);
}

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
  it("keeps the reviewed minimum dimensions for every shell skeleton", () => {
    expect(Object.fromEntries(["AppShell", "ChatHeader", "Composer", "ConversationNavigation", "Search", "Settings"].map((id) => {
      const limits = getSkeleton(id)!.meta.limits;
      return [id, [limits.minWidth, limits.minHeight]];
    }))).toEqual({
      AppShell: [320, 320],
      ChatHeader: [320, 44],
      Composer: [320, 44],
      ConversationNavigation: [256, 256],
      Search: [320, 280],
      Settings: [320, 320],
    });
  });

  it("uses own registry keys and exposes fixed ids to callers", () => {
    expect(panelRegistry.getSkeleton("ReviewPanel")).toBe(ReviewPanelEntry);
    expect(panelRegistry.getSkeleton("ReviewPanel")?.meta.slots).toEqual(["main"]);
    expect(panelRegistry.getSkeleton("ReviewPanel")?.meta.defaultStates).toEqual(["plain"]);
    expect(panelRegistry.getSkeleton("ReviewPanel")?.meta.commands).toEqual([]);
    expect(panelRegistry.getSkeleton("ReviewPanel")?.events).toEqual(["component_shown", "component_seen"]);
    expect(panelRegistry.getSkeleton("constructor")).toBeUndefined();
    expect(getSkeleton("constructor")).toBeUndefined();
    expect(createRegistry([], 1).entries.size).toBe(0);
  });

  it("allows fixed slots on non-Tabs entries whose props happen to include tabs", () => {
    const withFixedSlots = createRegistry([registry.getSkeleton("Tabs")!, fixedSlotPanel], registry.version);
    expect(withFixedSlots.getSkeleton("ResultsPanel")?.meta.galleryStates[0]?.slots).toEqual({ main: ["results"] });
  });

  it("preserves Nudge's no-argument callback through the registry boundary", () => {
    const nudge = registry.getSkeleton("Nudge")!;
    const onAction = vi.fn();
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() => root.render(<nudge.Component props={{ title: "Continue", message: "Details", actionLabel: "Open" }} slots={{}} onAction={onAction} />));
    act(() => (host.querySelector("button") as HTMLButtonElement).click());
    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction.mock.calls).toEqual([[]]);
    act(() => root.unmount());
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
    expect(await markup(renderMessage(spec, "fallback", panelRegistry))).toContain("<strong>7</strong><section class=\"review-panel\" data-count=\"3\"><strong>3</strong>");
  });

  it("falls back for inherited, unknown and missing-root component ids", async () => {
    expect(await markup(renderMessage({ ...goodLayout, elements: { panel: { type: "constructor", props: {} } } }, "plain answer", panelRegistry))).toContain("plain answer");
    expect(await markup(renderMessage({ ...goodLayout, children: [] }, "plain answer", panelRegistry))).toContain("plain answer");
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
    expect(ReviewPanelEntry.schema).toBe(panelDefinition.schema);

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

  it("renders Tabs content through named slots and rejects cross-field tab errors", async () => {
    const tabs = {
      registry_version: registry.version,
      root: "tabs",
      elements: {
        tabs: { type: "Tabs", props: { tabs: [{ id: "summary", label: "Summary" }], selected: "summary" }, slots: { summary: ["card"] } },
        card: { type: "Card", props: { title: "Named slot content", state: "default" }, slots: { content: [] } },
      },
    };
    expect(await markup(renderMessage(tabs, "fallback"))).toContain("Named slot content");
    const invalid = { ...tabs, elements: { ...tabs.elements, tabs: { ...tabs.elements.tabs, props: { ...tabs.elements.tabs.props, selected: "missing" } } } };
    expect(await markup(renderMessage(invalid, "plain fallback"))).toContain("plain fallback");
    const invalidSlot = { ...tabs, elements: { ...tabs.elements, tabs: { ...tabs.elements.tabs, slots: { unrelated: ["card"] } } } };
    expect(await markup(renderMessage(invalidSlot, "plain fallback"))).toContain("plain fallback");
  });

  it("rejects Metric progress bounds through renderer validation", async () => {
    const metric = {
      registry_version: registry.version,
      root: "metric",
      elements: { metric: { type: "Metric", props: { label: "Quota", value: "25", progress: { value: 25, max: 20 } } } },
    };
    expect(await markup(renderMessage(metric, "plain fallback"))).toContain("plain fallback");
  });

  it("falls back from a throwing message component in place", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const spec = {
      registry_version: 1,
      root: "panel",
      elements: {
        panel: { type: "ReviewPanel", props: { count: 7 }, slots: { main: ["child"] } },
        child: { type: "ReviewPanel", props: { count: 2, fail: true }, slots: { main: [] } },
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

  it("rejects cycles and advances once for multiple failures, then resets for new layouts", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const cyclic = {
      registry_version: 1,
      root: "panel",
      elements: { panel: { type: "ReviewPanel", props: { count: 3 }, slots: { main: ["panel"] } } },
    };
    expect(resolveLayout(cyclic, goodLayout, panelRegistry)).toEqual(goodLayout);
    expect(await markup(renderLayout(cyclic, goodLayout, panelRegistry))).toContain("<strong>8</strong>");
    expect(await markup(renderMessage(cyclic, "plain answer", panelRegistry))).toContain("plain answer");

    const manyFailures = {
      registry_version: 1,
      root: "panel",
      elements: {
        panel: { type: "ReviewPanel", props: { count: 3 }, slots: { main: ["bad1", "bad2"] } },
        bad1: { type: "ReviewPanel", props: { count: 1, fail: true }, slots: { main: [] } },
        bad2: { type: "ReviewPanel", props: { count: 2, fail: true }, slots: { main: [] } },
      },
    };
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(renderLayout(manyFailures, goodLayout, panelRegistry)));
    expect(container.innerHTML).toContain("<strong>8</strong>");
    const healthy = { ...goodLayout, elements: { panel: { type: "ReviewPanel", props: { count: 9 }, slots: { main: [] } } } };
    await act(async () => root.render(renderLayout(healthy, goodLayout, panelRegistry)));
    expect(container.innerHTML).toContain("<strong>9</strong>");
    await act(async () => root.unmount());
  });

  it("registers and renders a leaf with no slots", async () => {
    const leafMeta = { ...meta, slots: [] as const, galleryStates: [{ id: "plain", props: { count: 1 } }] };
    const definition = defineSkeletonDefinition({
      id: "ReviewLeaf",
      props: z.object({ count: z.number() }).strict(),
      slots: z.object({}).strict(),
      events,
      meta: leafMeta,
    });
    const leaf = defineSkeleton(definition, ({ count }: { count: number }) => <b>{count}</b>);
    const leafRegistry = createRegistry([leaf], 1);
    const spec = { registry_version: 1, root: "leaf", elements: { leaf: { type: "ReviewLeaf", props: { count: 5 } } } };
    expect(leafRegistry.getSkeleton("ReviewLeaf")).toBe(leaf);
    expect(await markup(renderMessage(spec, "fallback", leafRegistry))).toContain("<b>5</b>");
  });

  it("requires an explicit empty example for optional Skeleton slots", () => {
    const optionalSlotDefinition = (galleryStates: unknown) => defineSkeletonDefinition({
      id: "OptionalSlot",
      props: z.object({ count: z.number() }).strict(),
      slots: z.object({ main: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)).optional() }).strict(),
      events,
      meta: { ...meta, galleryStates } as never,
    });
    const OptionalSlot = defineSkeleton(optionalSlotDefinition([{ id: "plain", props: { count: 1 }, slots: {} }]), ({ count }: { count: number }) => <b>{count}</b>);
    expect(() => createRegistry([OptionalSlot], 1)).not.toThrow();
    const MissingSlotExample = defineSkeleton(optionalSlotDefinition([{ id: "plain", props: { count: 1 } }]), ({ count }: { count: number }) => <b>{count}</b>);
    expect(() => createRegistry([MissingSlotExample], 1)).toThrow(/OptionalSlot.*plain.*missing example slots/);
  });

  it("validates each slot example even when a sibling slot has a weak schema", () => {
    const mixedSlotDefinition = (side: unknown) => defineSkeletonDefinition({
      id: "MixedSlots",
      props: z.object({ count: z.number() }).strict(),
      slots: z.object({ main: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)), side: z.unknown().optional() }).strict(),
      events,
      meta: { ...meta, slots: ["main", "side"], defaultStates: ["busy"], galleryStates: [{ id: "busy", props: { count: 1 }, slots: { main: [], side } as never }] },
    });
    for (const side of [{ label: "not-a-child-list" }, ["BadChild"]]) {
      const MixedSlots = defineSkeleton(mixedSlotDefinition(side), ({ count }: { count: number }) => <b>{count}</b>);
      expect(() => createRegistry([MixedSlots], 1)).toThrow(/MixedSlots.*busy.*side/);
    }
  });

  it("accepts a public registry example with multiple required slots", () => {
    const definition = defineSkeletonDefinition({
      id: "TwoSlotPanel",
      props: z.object({ count: z.number() }).strict(),
      slots: z.object({ main: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)), side: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)) }).strict(),
      events,
      meta: { ...meta, slots: ["main", "side"], galleryStates: [{ id: "plain", props: { count: 1 }, slots: { main: [], side: [] } }] },
    });
    const entry = defineSkeleton(definition, ({ count }: { count: number }) => <b>{count}</b>);
    expect(createRegistry([entry], 1).getSkeleton("TwoSlotPanel")).toBe(entry);
  });

  it("rejects named-part slots that have no matching tab", () => {
    const tabs = registry.getSkeleton("Tabs")!;
    expect(tabs.schema.safeParse({ props: { tabs: [{ id: "summary", label: "Summary" }], selected: "summary" }, slots: { unrelated: ["child"] } }).success).toBe(false);
  });

  it("registers named slots that use Object.prototype names", () => {
    const tabs = registry.getSkeleton("Tabs")!;
    const galleryState = {
      id: "named_constructor",
      props: { tabs: [{ id: "constructor", label: "Summary" }], selected: "constructor" },
      slots: { constructor: ["child"] },
    };
    expect(() => createRegistry([{ ...tabs, meta: { ...tabs.meta, galleryStates: [...tabs.meta.galleryStates, galleryState] } }], registry.version)).not.toThrow();
  });

  it("enables named slot validation from the definition instead of a component name", () => {
    const definition = defineSkeletonDefinition({
      id: "NamedParts",
      props: z.object({ parts: z.array(z.object({ id: z.string() })) }),
      slots: z.object({}).catchall(z.array(z.string())),
      events,
      meta: { ...meta, slots: [] },
      namedPartProp: "parts",
    });
    expect(definition.schema.safeParse({ props: { parts: [{ id: "summary" }] }, slots: { summary: ["child"] } }).success).toBe(true);
    expect(definition.schema.safeParse({ props: { parts: [{ id: "summary" }] }, slots: { unrelated: ["child"] } }).success).toBe(false);
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
    const weakSlotDefinition = defineSkeletonDefinition({
      id: ReviewPanelEntry.id,
      props: propsSchema,
      slots: z.object({ main: z.array(z.string()).optional() }).strict(),
      events,
      meta,
    });
    const weakSlotEntry = defineSkeleton(weakSlotDefinition, ReviewPanel);
    expect(() => createRegistry([weakSlotEntry], 1)).toThrow(/T3 child ids/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, defaultStates: ["bad state"] } }], 1)).toThrow(/default state id/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, galleryStates: [{ id: "bad state", props: { count: 1 }, slots: { main: [] } }] } } as never], 1)).toThrow(/ReviewPanel.*gallery state id/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, galleryStates: [{ id: "plain", slots: { main: [] } }] } } as never], 1)).toThrow(/ReviewPanel.*plain.*example props/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, galleryStates: [{ id: "plain", props: { count: "bad" }, slots: { main: [] } }] } } as never], 1)).toThrow(/ReviewPanel.*plain.*props/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, galleryStates: [{ id: "plain", props: { count: 1 } }] } } as never], 1)).toThrow(/ReviewPanel.*plain.*missing example slots/);
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, galleryStates: [{ id: "plain", props: { count: 1 }, slots: { main: "bad" } }] } } as never], 1)).toThrow(/ReviewPanel.*plain.*slots/);
    for (const slots of ["bad", null]) {
      expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, galleryStates: [{ id: "busy", props: { count: 1 }, slots }] } } as never], 1)).toThrow(/ReviewPanel.*busy.*slots/);
    }
    expect(() => createRegistry([{ ...ReviewPanelEntry, id: "bad id" }], 1)).toThrow(/component id/);
  });

  it("requires a gallery example for every declared default state", () => {
    expect(() => createRegistry([{ ...ReviewPanelEntry, meta: { ...meta, defaultStates: ["plain", "busy"], galleryStates: [{ id: "plain", props: { count: 1 }, slots: { main: [] } }] } }], 1)).toThrow(/gallery states must include every default state/);
  });
});
