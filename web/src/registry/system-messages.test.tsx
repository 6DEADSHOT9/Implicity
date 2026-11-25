// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "./index";

class TestIntersectionObserver {
  static instances: TestIntersectionObserver[] = [];
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds: number[];
  target?: Element;
  private lastRatio?: number;

  constructor(private callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
    this.thresholds = Array.isArray(options.threshold) ? options.threshold : [options.threshold ?? 0];
    TestIntersectionObserver.instances.push(this);
  }
  observe(target: Element) {
    this.target = target;
    if (this.lastRatio !== undefined) this.deliver(this.lastRatio);
  }
  unobserve() { this.target = undefined; }
  disconnect() { this.target = undefined; }
  takeRecords() { return []; }
  setRatio(intersectionRatio: number) {
    this.lastRatio = intersectionRatio;
    this.deliver(intersectionRatio);
  }
  private deliver(intersectionRatio: number) {
    if (!this.target) return;
    this.callback([{ target: this.target, isIntersecting: intersectionRatio > 0, intersectionRatio, time: performance.now() } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

const checkVisibilityDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "checkVisibility");

beforeEach(() => {
  vi.useFakeTimers();
  TestIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
  Object.defineProperty(Element.prototype, "checkVisibility", {
    configurable: true,
    value(this: Element) {
      for (let node: Element | null = this; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      }
      return true;
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (checkVisibilityDescriptor) Object.defineProperty(Element.prototype, "checkVisibility", checkVisibilityDescriptor);
  else delete (Element.prototype as { checkVisibility?: () => boolean }).checkVisibility;
});

async function passTime(milliseconds: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
}

describe("system message seen events", () => {
  it("emits component_seen from each public Skeleton after it stays visible", async () => {
    const capture = recordingCapture();
    const examples = [
      ["ChangeNotice", { decision_id: "dec_123e4567-e89b-42d3-a456-426614174000", title: "Changed", reason: "Because.", presentation: "inline" }],
      ["ProposalCard", { proposal_id: "prop_123e4567-e89b-42d3-a456-426614174000", proposal_type: "look", title: "Look", description: "Details", preview: "Preview." }],
      ["Nudge", { title: "Continue", message: "Details.", actionLabel: "Open" }],
    ] as const;
    render(<CaptureProvider sink={capture.sink}>{examples.map(([id, props]) => {
      const entry = registry.getSkeleton(id)!;
      return <entry.Component key={id} props={props} slots={{}} />;
    })}</CaptureProvider>);

    const observers = TestIntersectionObserver.instances;
    expect(observers).toHaveLength(3);
    for (const observer of observers) {
      expect(observer.target).toBeTruthy();
      act(() => observer.setRatio(0.5));
    }
    await passTime(3000);

    expect(capture.events.filter(({ name }) => name === "component_seen")).toEqual([
      { name: "component_seen", component: "ChangeNotice", default_state: "inline", seconds_visible: 3 },
      { name: "component_seen", component: "ProposalCard", default_state: "preview", seconds_visible: 3 },
      { name: "component_seen", component: "Nudge", default_state: "prompt", seconds_visible: 3 },
    ]);
  });

  it("does not count a hidden ChangeNotice toast as seen, then counts it when shown", async () => {
    const capture = recordingCapture();
    const entry = registry.getSkeleton("ChangeNotice")!;
    render(<CaptureProvider sink={capture.sink}><entry.Component props={{ decision_id: "dec_123e4567-e89b-42d3-a456-426614174000", title: "Changed", reason: "Because.", presentation: "toast" }} slots={{}} /></CaptureProvider>);
    await passTime(0);
    const notice = screen.getByRole("status", { name: "Changed" });
    const observer = TestIntersectionObserver.instances.at(-1)!;
    expect(observer.target).toBe(notice);
    expect(capture.events).toContainEqual({ name: "change_shown", decision_id: "dec_123e4567-e89b-42d3-a456-426614174000" });
    const toast = notice.closest("[data-sonner-toast]");
    expect(toast).toBeTruthy();
    toast!.setAttribute("style", "display: none");
    act(() => observer.setRatio(1));
    await passTime(3500);
    expect(capture.events.some(({ name }) => name === "component_seen")).toBe(false);

    toast!.removeAttribute("style");
    await passTime(3300);
    expect(capture.events.filter(({ name }) => name === "component_seen")).toEqual([
      { name: "component_seen", component: "ChangeNotice", default_state: "toast", seconds_visible: 3 },
    ]);
  });
});
