// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture, useSeen } from "./index";

class TestIntersectionObserver {
  static instances: TestIntersectionObserver[] = [];
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0, 0.5];
  constructor(private callback: IntersectionObserverCallback) { TestIntersectionObserver.instances.push(this); }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
  setRatio(target: Element, ratio: number) {
    this.callback([{ target, isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

function Probe({ slot }: { slot?: string }) {
  const ref = useSeen({ component: "ReviewPanel", defaultState: "plain", slot });
  return <section ref={ref}>probe</section>;
}

function setup(slot?: string) {
  const capture = recordingCapture();
  const view = render(<CaptureProvider sink={capture.sink}><Probe slot={slot} /></CaptureProvider>);
  const element = view.getByText("probe").parentElement!;
  return { ...view, capture, element, observer: TestIntersectionObserver.instances.at(-1)! };
}

beforeEach(() => {
  vi.useFakeTimers();
  TestIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

async function passTime(ms: number) { await act(async () => { vi.advanceTimersByTime(ms); }); }

const seen = { name: "component_seen", component: "ReviewPanel", default_state: "plain", seconds_visible: 3 };

describe("useSeen", () => {
  it("emits after three seconds at least half visible and reports visible seconds", async () => {
    const { capture, observer, element } = setup("main");
    act(() => observer.setRatio(element, 0.5));
    vi.setSystemTime(Date.now() + 500);
    await passTime(3000);
    expect(capture.events).toEqual([{ ...seen, seconds_visible: 3.5, slot: "main" }]);
  });

  it("does not emit while hidden or less than half visible", async () => {
    const { capture, observer, element } = setup();
    act(() => observer.setRatio(element, 0.49));
    await passTime(4000);
    expect(capture.events).toEqual([]);
    act(() => observer.setRatio(element, 0));
    act(() => observer.setRatio(element, 0.6));
    await passTime(1000);
    act(() => observer.setRatio(element, 0));
    await passTime(4000);
    expect(capture.events).toEqual([]);
  });

  it("resets the timer when it leaves, then reports the visible time once per mount", async () => {
    const { capture, observer, element } = setup();
    act(() => observer.setRatio(element, 0.8));
    await passTime(2000);
    act(() => observer.setRatio(element, 0.2));
    await passTime(2000);
    act(() => observer.setRatio(element, 1));
    await passTime(2999);
    expect(capture.events).toEqual([]);
    await passTime(1);
    expect(capture.events).toEqual([seen]);
    act(() => observer.setRatio(element, 0));
    act(() => observer.setRatio(element, 1));
    await passTime(5000);
    expect(capture.events).toEqual([seen]);
  });
});
