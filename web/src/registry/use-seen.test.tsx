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
  private nextObserveBatch?: number[];

  constructor(private callback: IntersectionObserverCallback, readonly options: ObserverOptions) {
    this.thresholds = Array.isArray(options.threshold) ? options.threshold : [options.threshold];
    TestIntersectionObserver.instances.push(this);
  }
  observe(target: Element) {
    this.target = target;
    if (this.nextObserveBatch) {
      const batch = this.nextObserveBatch;
      this.nextObserveBatch = undefined;
      this.deliver(batch);
    } else if (this.lastRatio !== undefined) this.deliver([this.lastRatio]);
  }
  unobserve() { this.target = undefined; }
  disconnect() { this.target = undefined; }
  takeRecords() { return []; }
  onNextObserve(ratios: number[]) { this.nextObserveBatch = ratios; }
  setRatio(ratio: number) {
    if (!this.target) return;
    const prior = this.lastRatio;
    const thresholdIndex = (value: number) => this.thresholds.filter((threshold) => value >= threshold).length;
    if (prior !== undefined && thresholdIndex(prior) === thresholdIndex(ratio) && (prior > 0) === (ratio > 0)) {
      this.lastRatio = ratio;
      return;
    }
    this.deliver([ratio]);
  }
  deliver(ratios: number[]) {
    if (!this.target) return;
    this.lastRatio = ratios.at(-1);
    const time = performance.now();
    this.callback(ratios.map((intersectionRatio) => ({
      target: this.target!, isIntersecting: intersectionRatio > 0, intersectionRatio, time,
    } as IntersectionObserverEntry)), this as unknown as IntersectionObserver);
  }
}

type ProbeProps = { slot?: string; tag?: "section" | "article"; onVisible?: () => void };
function Probe({ slot, tag: Tag = "section", onVisible }: ProbeProps) {
  const ref = useSeen({ component: "ReviewPanel", defaultState: "plain", slot, onVisible });
  return <Tag ref={ref}>probe</Tag>;
}

function setup(slot?: string) {
  const capture = recordingCapture();
  const view = render(<CaptureProvider sink={capture.sink}><Probe slot={slot} /></CaptureProvider>);
  const element = view.getByText("probe");
  const checkVisibility = setVisible(element, true);
  return { ...view, capture, element, checkVisibility, observer: TestIntersectionObserver.instances.at(-1)! };
}

function setVisible(element: Element, visible: boolean) {
  const checkVisibility = vi.fn(() => visible);
  Object.defineProperty(element, "checkVisibility", { configurable: true, value: checkVisibility });
  return checkVisibility;
}

beforeEach(() => {
  vi.useFakeTimers();
  TestIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
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
    expect(element.checkVisibility).toHaveBeenCalledWith({ opacityProperty: true, visibilityProperty: true });
  });

  it("signals first displayability through the same visibility observation", async () => {
    const onVisible = vi.fn();
    const capture = recordingCapture();
    const view = render(<CaptureProvider sink={capture.sink}><Probe onVisible={onVisible} /></CaptureProvider>);
    const shownObserver = TestIntersectionObserver.instances.at(-1)!;
    setVisible(view.getByText("probe"), false);
    act(() => shownObserver.setRatio(1));
    expect(onVisible).not.toHaveBeenCalled();
    setVisible(view.getByText("probe"), true);
    await passTime(3000);
    expect(onVisible).toHaveBeenCalledOnce();
  });

  it("uses the final intersection in a batch before signaling displayability", () => {
    const onVisible = vi.fn();
    const view = render(<CaptureProvider sink={() => undefined}><Probe onVisible={onVisible} /></CaptureProvider>);
    setVisible(view.getByText("probe"), true);
    const observer = TestIntersectionObserver.instances.at(-1)!;
    act(() => observer.deliver([0.8, 0]));
    expect(onVisible).not.toHaveBeenCalled();
    act(() => observer.deliver([0, 0.8]));
    expect(onVisible).toHaveBeenCalledOnce();
  });

  it("does not emit when under half visible", async () => {
    const { capture, observer } = setup();
    act(() => observer.setRatio(0));
    await passTime(4000);
    act(() => observer.setRatio(0.49));
    await passTime(4000);
    expect(capture.events).toEqual([]);
  });

  it("resets the same target's timer on an exit and re-entry before its deadline", async () => {
    const { capture, observer } = setup();
    act(() => observer.setRatio(0.8));
    await passTime(1000);
    act(() => observer.setRatio(0));
    await passTime(500);
    act(() => observer.setRatio(0.8));
    await passTime(2999);
    expect(capture.events).toEqual([]);
    await passTime(1);
    expect(capture.events).toEqual([seen]);
  });

  it("emits once across ref replacement and once again after a genuine remount", async () => {
    const { capture, observer, rerender, unmount } = setup();
    act(() => observer.setRatio(1));
    await passTime(1000);
    rerender(<CaptureProvider sink={capture.sink}><Probe tag="article" /></CaptureProvider>);
    const replacementObserver = TestIntersectionObserver.instances.at(-1)!;
    expect(replacementObserver.target?.tagName).toBe("ARTICLE");
    setVisible(replacementObserver.target!, true);
    act(() => replacementObserver.setRatio(1));
    await passTime(3000);
    expect(capture.events).toEqual([seen]);
    const observersBeforeReplacement = TestIntersectionObserver.instances.length;
    rerender(<CaptureProvider sink={capture.sink}><Probe /></CaptureProvider>);
    if (TestIntersectionObserver.instances.length > observersBeforeReplacement) {
      const duplicateObserver = TestIntersectionObserver.instances.at(-1)!;
      setVisible(duplicateObserver.target!, true);
      act(() => duplicateObserver.setRatio(1));
    }
    await passTime(3000);
    expect(capture.events).toEqual([seen]);
    unmount();
    render(<CaptureProvider sink={capture.sink}><Probe /></CaptureProvider>);
    const remountedObserver = TestIntersectionObserver.instances.at(-1)!;
    setVisible(remountedObserver.target!, true);
    act(() => remountedObserver.setRatio(1));
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

  it("uses the last fresh observation at the deadline", async () => {
    const { capture, observer } = setup();
    act(() => observer.setRatio(0.8));
    observer.onNextObserve([0.8, 0]);
    await passTime(3000);
    expect(capture.events).toEqual([]);
  });

  it("checks native visibility at the deadline and starts a fresh stretch after reveal", async () => {
    const { capture, observer, element } = setup();
    act(() => observer.setRatio(1));
    await passTime(2999);
    setVisible(element, false);
    await passTime(1);
    expect(capture.events).toEqual([]);
    setVisible(element, true);
    await passTime(3000);
    expect(capture.events).toEqual([]);
    await passTime(3000);
    expect(capture.events).toEqual([seen]);
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
