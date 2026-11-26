// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "./index";

class VisibleObserver {
  static instances: VisibleObserver[] = [];
  target?: Element;
  ratio?: number;
  constructor(private callback: IntersectionObserverCallback) { VisibleObserver.instances.push(this); }
  observe(target: Element) { this.target = target; if (this.ratio !== undefined) this.deliver(this.ratio); }
  unobserve() { this.target = undefined; }
  disconnect() { this.target = undefined; }
  takeRecords() { return []; }
  deliver(ratio: number) {
    if (!this.target) return;
    this.ratio = ratio;
    this.target.checkVisibility = () => true;
    this.callback([{ target: this.target, isIntersecting: ratio > 0, intersectionRatio: ratio, time: performance.now() } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("shell seen events", () => {
  it("waits for three visible seconds in each public gallery entry", async () => {
    vi.useFakeTimers();
    VisibleObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", VisibleObserver);
    const capture = recordingCapture();
    render(<CaptureProvider sink={capture.sink}>{["AppShell", "ConversationNavigation", "Composer", "ChatHeader", "Search", "Settings"].map((id) => {
      const entry = registry.getSkeleton(id)!;
      const state = entry.meta.galleryStates[0];
      return <entry.Component key={id} props={state.props} slots={state.slots ?? {}} />;
    })}</CaptureProvider>);
    expect(capture.events).toEqual(["AppShell", "ConversationNavigation", "Composer", "ChatHeader", "Search", "Settings"].map((component) => {
      const state = registry.getSkeleton(component)!.meta.galleryStates[0];
      return { name: "component_shown", component, default_state: state.id };
    }));
    act(() => VisibleObserver.instances.forEach((observer) => observer.deliver(1)));
    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(capture.events.filter(({ name }) => name === "component_seen")).toEqual([]);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(capture.events.filter(({ name }) => name === "component_seen")).toHaveLength(6);
    expect(capture.events.filter(({ name }) => name === "component_seen").map(({ component }) => component).sort()).toEqual(["AppShell", "ChatHeader", "Composer", "ConversationNavigation", "Search", "Settings"]);
  });
});
