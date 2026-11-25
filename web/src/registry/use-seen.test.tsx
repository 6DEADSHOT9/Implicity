// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture, SEEN_VISIBLE_RATIO, SEEN_VISIBLE_SECONDS, useSeen } from "./index";

type ObserverOptions = IntersectionObserverInit & { threshold: number[] };
class TestIntersectionObserver {
  static instances: TestIntersectionObserver[] = [];
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds: number[];
  target?: Element;
  private lastRatio?: number;

  constructor(private callback: IntersectionObserverCallback, readonly options: ObserverOptions) {
    this.thresholds = Array.isArray(options.threshold) ? options.threshold : [options.threshold];
    TestIntersectionObserver.instances.push(this);
  }
  observe(target: Element) { this.target = target; }
  unobserve() { this.target = undefined; }
  disconnect() { this.target = undefined; }
  takeRecords() { return []; }
  setRatio(ratio: number) {
    if (!this.target) return;
    const prior = this.lastRatio;
    const thresholdIndex = (value: number) => this.thresholds.filter((threshold) => value >= threshold).length;
    if (prior !== undefined && thresholdIndex(prior) === thresholdIndex(ratio) && (prior > 0) === (ratio > 0)) {
      this.lastRatio = ratio;
      return;
    }
    this.lastRatio = ratio;
    this.deliver([ratio]);
  }
  deliver(ratios: number[]) {
    if (!this.target) return;
    const time = performance.now();
    this.callback(ratios.map((intersectionRatio, index) => ({
      target: this.target!, isIntersecting: intersectionRatio > 0, intersectionRatio, time,
    } as IntersectionObserverEntry)), this as unknown as IntersectionObserver);
  }
}

type ProbeProps = { slot?: string; tag?: "section" | "article" };
function Probe({ slot, tag: Tag = "section" }: ProbeProps) {
  const ref = useSeen({ component: "ReviewPanel", defaultState: "plain", slot });
  return <Tag ref={ref}>probe</Tag>;
}

function setup(slot?: string) {
  const capture = recordingCapture();
  const view = render(<CaptureProvider sink={capture.sink}><Probe slot={slot} /></CaptureProvider>);
  const element = view.getByText("probe");
  setBounds(element);
  return { ...view, capture, element, observer: TestIntersectionObserver.instances.at(-1)! };
}

function setBounds(element: Element) {
  Object.defineProperty(element, "getBoundingClientRect", { configurable: true, value: () => ({ top: 0, right: 100, bottom: 100, left: 0, width: 100, height: 100, x: 0, y: 0, toJSON() {} }) });
}

beforeEach(() => {
  vi.useFakeTimers();
  TestIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
  Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 1000 });
  Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 1000 });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function passTime(ms: number) { await act(async () => { vi.advanceTimersByTime(ms); }); }
const seen = { name: "component_seen", component: "ReviewPanel", default_state: "plain", seconds_visible: 3 };

describe("useSeen", () => {
  it("observes its ref at the exported threshold and emits at half visibility", async () => {
    const { capture, observer, element } = setup("main");
    expect(observer.target).toBe(element);
    expect(SEEN_VISIBLE_RATIO).toBe(0.5);
    expect(SEEN_VISIBLE_SECONDS).toBe(3);
    expect(observer.thresholds).toContain(SEEN_VISIBLE_RATIO);
    act(() => observer.setRatio(0.49));
    await passTime(3000);
    expect(capture.events).toEqual([]);
    act(() => observer.setRatio(0.5));
    await passTime(3000);
    expect(capture.events).toEqual([{ ...seen, slot: "main" }]);
  });

  it("does not emit while hidden or under half visible", async () => {
    const { capture, observer } = setup();
    act(() => observer.setRatio(0));
    await passTime(4000);
    act(() => observer.setRatio(0.49));
    await passTime(4000);
    expect(capture.events).toEqual([]);
  });

  it("resets after leaving and emits once per mount, including across ref replacement", async () => {
    const { capture, observer, element, rerender, unmount } = setup();
    act(() => observer.setRatio(0.8));
    await passTime(2000);
    act(() => observer.setRatio(0.2));
    await passTime(2000);
    rerender(<CaptureProvider sink={capture.sink}><Probe tag="article" /></CaptureProvider>);
    const replacement = document.querySelector("article")!;
    setBounds(replacement);
    const replacementObserver = TestIntersectionObserver.instances.at(-1)!;
    expect(replacementObserver.target).toBe(replacement);
    act(() => replacementObserver.setRatio(0.8));
    await passTime(3000);
    expect(capture.events).toEqual([seen]);
    rerender(<CaptureProvider sink={capture.sink}><Probe /></CaptureProvider>);
    const sameMountTarget = document.querySelector("section")!;
    setBounds(sameMountTarget);
    act(() => TestIntersectionObserver.instances.at(-1)!.setRatio(1));
    await passTime(3000);
    expect(capture.events).toEqual([seen]);
    unmount();
    render(<CaptureProvider sink={capture.sink}><Probe /></CaptureProvider>);
    setBounds(document.querySelector("section")!);
    act(() => TestIntersectionObserver.instances.at(-1)!.setRatio(0.8));
    await passTime(3000);
    expect(capture.events).toEqual([seen, seen]);
  });

  it("uses the final crossing in an observer batch", async () => {
    const { capture, observer } = setup();
    act(() => observer.deliver([0.8, 0]));
    await passTime(3000);
    expect(capture.events).toEqual([]);
    act(() => observer.deliver([0, 0.8]));
    await passTime(3000);
    expect(capture.events).toEqual([seen]);
  });

  it("rechecks current CSS visibility when the timer fires", async () => {
    const { capture, observer, element } = setup();
    act(() => observer.setRatio(1));
    await passTime(2999);
    Object.defineProperty(element, "getBoundingClientRect", { configurable: true, value: () => ({ top: 1000, right: 1100, bottom: 1100, left: 1000, width: 100, height: 100, x: 1000, y: 1000, toJSON() {} }) });
    await passTime(1);
    expect(capture.events).toEqual([]);
  });

  it("reports the full elapsed interval when the timer callback is delayed", async () => {
    const { capture, observer } = setup();
    const startedAt = performance.now();
    const monotonicNow = vi.spyOn(performance, "now").mockReturnValue(startedAt);
    act(() => observer.setRatio(1));
    monotonicNow.mockReturnValue(startedAt + 3500);
    await passTime(3000);
    expect(capture.events).toEqual([{ ...seen, seconds_visible: 3.5 }]);
  });

  it("measures with a monotonic clock despite wall-clock adjustment", async () => {
    const { capture, observer } = setup();
    act(() => observer.setRatio(1));
    vi.setSystemTime(Date.now() - 60_000);
    await passTime(3000);
    expect(capture.events).toEqual([seen]);
  });
});
