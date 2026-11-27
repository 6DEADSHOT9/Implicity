// @vitest-environment jsdom
import { act, type ReactElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { render as renderView, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Ajv2020 from "ajv/dist/2020.js";
import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureProvider, createRegistry, defineSkeleton, defineSkeletonDefinition, getSkeleton, recordingCapture, registry } from "../src/registry";
import { baselineLayout, renderLayout, renderMessage, resolveLayout } from "../src/renderer";
import { events } from "./fixtures/ReviewPanel/events";
import { meta } from "./fixtures/ReviewPanel/meta";
import { ReviewPanelEntry } from "./fixtures/ReviewPanel/entry";
import { ReviewPanel } from "./fixtures/ReviewPanel/ReviewPanel";
import { definition as panelDefinition, propsSchema } from "./fixtures/ReviewPanel/schema";
import { ReviewShellEntry } from "./fixtures/ReviewShell/entry";
import { Details as DetailsForTest } from "../src/registry/Details/Details";
import { RunActivity as RunActivityForTest } from "../src/registry/RunActivity/RunActivity";

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

class RegistryIntersectionObserver {
  static instances: RegistryIntersectionObserver[] = [];
  target?: Element;
  ratio?: number;
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0, 0.5];
  constructor(private callback: IntersectionObserverCallback) { RegistryIntersectionObserver.instances.push(this); }
  observe(target: Element) { this.target = target; if (this.ratio !== undefined) this.deliver(this.ratio); }
  unobserve() { this.target = undefined; }
  disconnect() { this.target = undefined; }
  takeRecords() { return []; }
  setRatio(intersectionRatio: number) {
    this.ratio = intersectionRatio;
    this.deliver(intersectionRatio);
  }
  private deliver(intersectionRatio: number) {
    if (!this.target) return;
    this.callback([{ target: this.target, isIntersecting: intersectionRatio > 0, intersectionRatio, time: performance.now() } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

const previousCheckVisibility = Element.prototype.checkVisibility;

const conversationIds = ["MessageBody", "Details", "RunActivity", "MessageActions", "AttachmentTray", "Citation", "ContextChip", "ShortcutChips", "ApprovalRequest"] as const;
const sentinels = { message: "private-message-sentinel", label: "private-label-sentinel", file: "private-file-path-sentinel" };

function propsWithSentinel(id: string, props: Record<string, unknown>) {
  switch (id) {
    case "MessageBody": return { ...props, content: sentinels.message };
    case "Details": return { ...props, title: sentinels.label, content: sentinels.message };
    case "RunActivity": return { ...props, title: sentinels.label, steps: [{ label: sentinels.message, status: "running" }] };
    case "AttachmentTray": return { ...props, attachments: [{ id: "3f2504e0-4f89-41d3-9a0c-0305e82c3304", name: sentinels.file, type: "document" }] };
    case "Citation": return { ...props, label: sentinels.label };
    case "ContextChip": return { ...props, detail: sentinels.label };
    case "ShortcutChips": return { ...props, commands: [{ id: "copy_answer", label: sentinels.label }] };
    case "ApprovalRequest": return { ...props, title: sentinels.label, detail: sentinels.message };
    default: return props;
  }
}

describe("conversation registry entries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    RegistryIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", RegistryIntersectionObserver);
    Object.defineProperty(Element.prototype, "checkVisibility", { configurable: true, value: () => true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (previousCheckVisibility) Object.defineProperty(Element.prototype, "checkVisibility", { configurable: true, value: previousCheckVisibility });
    else delete (Element.prototype as Partial<Element>).checkVisibility;
  });

  it("renders every declared gallery state through the public renderer and validates its example", () => {
    for (const id of conversationIds) {
      const entry = registry.getSkeleton(id)!;
      for (const state of entry.meta.galleryStates) {
        expect(entry.schema.safeParse({ props: state.props, slots: state.slots ?? {} }).success, `${id} ${state.id}`).toBe(true);
        const view = renderView(<entry.Component props={state.props} slots={Object.fromEntries(Object.entries(state.slots ?? {}).map(([slot, children]) => [slot, children])) as Record<string, ReactNode>} />);
        expect(view.container.textContent, `${id} ${state.id}`).not.toBe("");
        if (id === "Details") expect(view.container.textContent).not.toContain("message_body");
        view.unmount();
      }
    }
  });

  it("emits only the mount event and one exact seen event for each skeleton", async () => {
    for (const id of conversationIds) {
      const entry = registry.getSkeleton(id)!;
      const state = entry.meta.galleryStates[id === "AttachmentTray" ? 1 : 0];
      const defaultState = id === "AttachmentTray" ? "attached" : entry.meta.defaultStates[0];
      const slot = id === "Details" ? "details" : id === "RunActivity" ? "steps" : undefined;
      const recorder = recordingCapture();
      const view = renderView(<CaptureProvider sink={recorder.sink}><entry.Component props={propsWithSentinel(id, state.props)} slots={{}} /></CaptureProvider>);
      const shown = { name: "component_shown", component: id, default_state: defaultState, ...(slot ? { slot } : {}) };
      expect(recorder.events).toEqual([shown]);

      act(() => RegistryIntersectionObserver.instances.at(-1)!.setRatio(1));
      await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
      expect(recorder.events).toEqual([shown, { name: "component_seen", component: id, default_state: defaultState, seconds_visible: 3, ...(slot ? { slot } : {}) }]);
      const serialized = JSON.stringify(recorder.events);
      expect(serialized).not.toContain(sentinels.message);
      expect(serialized).not.toContain(sentinels.label);
      expect(serialized).not.toContain(sentinels.file);
      view.unmount();
    }
  });

  it.each(["Details", "RunActivity"] as const)("keeps %s seen data from its mount-time choice after it opens", async (id) => {
    const recorder = recordingCapture();
    const renderSection = (open: boolean) => id === "Details"
      ? <DetailsForTest title="Why" content="Details" open={open} />
      : <RunActivityForTest title="Run" steps={[{ label: "Search", status: "complete" }]} open={open} />;
    const view = renderView(<CaptureProvider sink={recorder.sink}>{renderSection(false)}</CaptureProvider>);
    act(() => RegistryIntersectionObserver.instances.at(-1)!.setRatio(1));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    view.rerender(<CaptureProvider sink={recorder.sink}>{renderSection(true)}</CaptureProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(recorder.events.at(-1)).toMatchObject({ name: "component_seen", component: id, default_state: "folded", slot: id === "Details" ? "details" : "steps", seconds_visible: 3 });
  });

  it("renders Details content from a valid public message spec without a slot", async () => {
    const spec = {
      registry_version: registry.version,
      root: "details",
      elements: { details: { type: "Details", props: { title: "Why", content: "MY DETAILS CONTENT", open: true }, slots: {} } },
    };
    const html = await markup(renderMessage(spec, "fallback"));
    expect(html).toContain("MY DETAILS CONTENT");
    expect(html).not.toContain("message_body");
  });

  it("renders a valid RunActivity spec with no slot or an empty slots object", async () => {
    for (const slots of [undefined, {}]) {
      const spec = {
        registry_version: registry.version,
        root: "activity",
        elements: {
          activity: {
            type: "RunActivity",
            props: { title: "Run", steps: [{ label: "Search", status: "complete" }], open: true },
            ...(slots ? { slots } : {}),
          },
        },
      };
      expect(await markup(renderMessage(spec, "fallback"))).toContain("Search");
    }
  });

  it("rejects ShortcutChips Commands that are not built in or app minted", async () => {
    const spec = {
      registry_version: registry.version,
      root: "shortcuts",
      elements: {
        shortcuts: {
          type: "ShortcutChips",
          props: { commands: [{ id: "command_without_implementation", label: "Run" }] },
          slots: {},
        },
      },
    };
    const html = await markup(renderMessage(spec, "Safe fallback"));
    expect(html).toContain("Safe fallback");
    expect(html).not.toContain("command_without_implementation");

    const acceptedSpec = {
      ...spec,
      elements: {
        shortcuts: {
          ...spec.elements.shortcuts,
          props: { commands: [{ id: "copy_answer", label: "Copy" }, { id: "cmd_123e4567-e89b-42d3-a456-426614174000", label: "Workflow" }] },
        },
      },
    };
    const acceptedHtml = await markup(renderMessage(acceptedSpec, "Safe fallback"));
    expect(acceptedHtml).toContain("Copy");
    expect(acceptedHtml).toContain("Workflow");
  });
});


describe("registry and renderer", () => {
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

  it("renders a static open WidgetPicker message inline", async () => {
    const user = userEvent.setup();
    const spec = {
      registry_version: registry.version,
      root: "picker",
      elements: { picker: { type: "WidgetPicker", props: {
        open: true,
        title: "Add widgets",
        widgets: [{ widgetId: "home_resume", componentId: "ResumeWidget", label: "Resume", enabled: true }],
        availableWidgets: [{ widgetId: "supplier_watch", componentId: "DataTable", label: "Data table" }],
      }, slots: {} } },
    };
    renderView(renderMessage(spec, "fallback"));
    const preview = await screen.findByRole("region", { name: "Add widgets" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(preview).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Customize" })).toBeNull();
    const resumeSwitch = screen.getByRole("switch", { name: "Resume" });
    resumeSwitch.focus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "Add widgets" })).toBe(preview);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add Data table" }));
    expect(screen.getByRole("region", { name: "Add widgets" })).toBe(preview);
    await user.tab();
    expect(preview.contains(document.activeElement)).toBe(false);
  });

  it("keeps a closed callback-free WidgetPicker message static", async () => {
    const spec = {
      registry_version: registry.version,
      root: "picker",
      elements: { picker: { type: "WidgetPicker", props: { open: false, title: "Add widgets", widgets: [], availableWidgets: [] }, slots: {} } },
    };
    const html = await markup(renderMessage(spec, "fallback"));
    expect(html).toContain("Customize");
    expect(html).not.toContain("<button");
    expect(html).not.toContain('role="dialog"');
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
