import { act } from "@testing-library/react";
import { vi } from "vitest";

class VisibleIntersectionObserver {
  static observers: VisibleIntersectionObserver[] = [];
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0, 0.5];
  target?: Element;
  private lastRatio?: number;

  constructor(private readonly callback: IntersectionObserverCallback) {
    VisibleIntersectionObserver.observers.push(this);
  }

  observe(target: Element) {
    this.target = target;
    if (this.lastRatio !== undefined) this.deliver(this.lastRatio);
  }
  unobserve() { this.target = undefined; }
  disconnect() { this.target = undefined; }
  takeRecords() { return []; }
  enter() {
    this.deliver(1);
  }
  private deliver(ratio: number) {
    if (!this.target) return;
    this.lastRatio = ratio;
    this.callback([{ target: this.target, isIntersecting: ratio > 0, intersectionRatio: ratio, time: performance.now() } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

export function installVisibleIntersectionObserver() {
  VisibleIntersectionObserver.observers = [];
  vi.stubGlobal("IntersectionObserver", VisibleIntersectionObserver);
}

export function enterSeenTarget(target: Element) {
  Object.defineProperty(target, "checkVisibility", { configurable: true, value: () => true });
  const observer = [...VisibleIntersectionObserver.observers].reverse().find((instance) => instance.target === target);
  if (!observer) throw new Error("useSeen did not observe the rendered panel");
  act(() => observer.enter());
}

export async function passSeenInterval() {
  await act(async () => { vi.advanceTimersByTime(3000); });
}
