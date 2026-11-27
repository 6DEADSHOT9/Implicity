// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture, registry, skeletonMetaSchema } from "./index";
import { validateRegistryDefinitions } from "./validate";

class TestIntersectionObserver {
  static instances: TestIntersectionObserver[] = [];
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0, 0.5];
  target?: Element;
  private ratio?: number;
  constructor(private callback: IntersectionObserverCallback) { TestIntersectionObserver.instances.push(this); }
  observe(target: Element) { this.target = target; if (this.ratio !== undefined) this.deliver(this.ratio); }
  unobserve() { this.target = undefined; }
  disconnect() { this.target = undefined; }
  takeRecords() { return []; }
  setRatio(ratio: number) { this.ratio = ratio; this.deliver(ratio); }
  private deliver(ratio: number) {
    if (!this.target) return;
    this.callback([{ target: this.target, isIntersecting: ratio > 0, intersectionRatio: ratio, time: performance.now() } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

const visibility = Object.getOwnPropertyDescriptor(Element.prototype, "checkVisibility");
beforeEach(() => {
  vi.useFakeTimers();
  TestIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
  Object.defineProperty(Element.prototype, "checkVisibility", { configurable: true, value: () => true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (visibility) Object.defineProperty(Element.prototype, "checkVisibility", visibility);
  else delete (Element.prototype as { checkVisibility?: () => boolean }).checkVisibility;
});

async function passTime(milliseconds: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
}

describe("Home Skeleton occasions", () => {
  it("keeps the empty and long-content gallery examples and the picker's open state", () => {
    const ids = ["HomeGrid", "WidgetFrame", "ResumeWidget", "ProjectsWidget", "ScheduledWidget", "QuickPromptsWidget", "NowPlayingWidget"];
    for (const id of ids) {
      const states = registry.getSkeleton(id)!.meta.galleryStates;
      expect(states.map(({ id: state }) => state)).toContain("empty");
      const longContent = states.find(({ id: state }) => state === "long-content")!;
      if (id === "HomeGrid" || id === "WidgetFrame") expect(longContent.props.title).toHaveLength(150);
      expect(Object.values(longContent.slots ?? {}).flat().some((slot) => slot.length >= 64)).toBe(true);
    }
    const picker = registry.getSkeleton("WidgetPicker")!.meta.galleryStates;
    expect(picker.map(({ id }) => id)).toEqual(expect.arrayContaining(["open", "long-content"]));
    expect(picker.find(({ id }) => id === "long-content")!.props.title).toHaveLength(150);
    expect(picker.find(({ id }) => id === "long-content")!.props.widgets).toHaveLength(5);
  });

  it("requires an interval for interval refreshed widgets", () => {
    const meta = registry.getSkeleton("ScheduledWidget")!.meta;
    expect(skeletonMetaSchema.safeParse({ ...meta, widget: { source: "scheduled_source", refresh: "interval" } }).success).toBe(false);
    expect(skeletonMetaSchema.safeParse({ ...meta, widget: { source: "scheduled_source", refresh: "interval", intervalMinutes: 30 } }).success).toBe(false);
    expect(skeletonMetaSchema.safeParse({ ...meta, widget: { source: "scheduled_source", refresh: "interval", intervalMinutes: 60 } }).success).toBe(true);
    expect(skeletonMetaSchema.safeParse({ ...meta, widget: { source: "Invalid source", refresh: "live" } }).success).toBe(false);
    for (const id of ["ResumeWidget", "ProjectsWidget", "ScheduledWidget", "QuickPromptsWidget", "NowPlayingWidget"]) {
      expect(registry.getSkeleton(id)!.meta.widget).toBeTruthy();
    }
  });

  it("requires widget metadata on every built-in widget definition", () => {
    const builtIns = ["ResumeWidget", "ProjectsWidget", "ScheduledWidget", "QuickPromptsWidget", "NowPlayingWidget"];
    for (const id of builtIns) {
      const definitions = [...registry.entries.values()].map((entry) => entry.id === id
        ? { ...entry, meta: { ...entry.meta, widget: undefined } }
        : entry);
      expect(() => validateRegistryDefinitions(definitions)).toThrow(`${id} is missing widget metadata`);
    }
  });

  it("emits seen once per Skeleton only after it stays visible for three seconds", async () => {
    const capture = recordingCapture();
    const ids = ["HomeGrid", "WidgetFrame", "WidgetPicker", "ResumeWidget", "ProjectsWidget", "ScheduledWidget", "QuickPromptsWidget", "NowPlayingWidget"];
    render(<CaptureProvider sink={capture.sink}>{ids.map((id) => {
      const entry = registry.getSkeleton(id)!;
      const state = entry.meta.galleryStates.find(({ id: stateId }) => stateId === "open") ?? entry.meta.galleryStates[0];
      const props = id === "WidgetPicker" ? { ...state.props, open: true } : state.props;
      const slots = Object.fromEntries(entry.meta.slots.map((slot) => [slot, []]));
      return <entry.Component key={id} props={props} slots={slots} />;
    })}</CaptureProvider>);

    expect(TestIntersectionObserver.instances).toHaveLength(ids.length);
    expect(capture.events.filter(({ name }) => name === "component_seen")).toEqual([]);
    for (const observer of TestIntersectionObserver.instances) act(() => observer.setRatio(1));
    await passTime(2999);
    expect(capture.events.filter(({ name }) => name === "component_seen")).toEqual([]);
    await passTime(1);
    expect(capture.events.filter(({ name }) => name === "component_seen").sort((a, b) => (a.component ?? "").localeCompare(b.component ?? ""))).toEqual(ids.map((component) => ({
      name: "component_seen",
      component,
      default_state: component === "WidgetPicker" ? "open" : registry.getSkeleton(component)!.meta.defaultStates[0],
      seconds_visible: 3,
    })).sort((a, b) => (a.component ?? "").localeCompare(b.component ?? "")));
  });
});
