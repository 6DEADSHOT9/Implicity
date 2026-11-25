// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "./index";
import { ChangeNotice } from "./ChangeNotice/ChangeNotice";
import { ChangeNoticeToastHost } from "../components/change-notice-toast-host";
import { renderMessage } from "../renderer";

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
  it("shares the document host across renderMessage calls and routes toast events to each origin", async () => {
    const first = recordingCapture();
    const second = recordingCapture();
    const spec = (decision_id: string, title: string, root: string) => ({
      registry_version: registry.version,
      root,
      elements: { [root]: { type: "ChangeNotice", props: { decision_id, title, reason: "Because.", presentation: "toast" } } },
    });
    render(<><ChangeNoticeToastHost />
      <CaptureProvider sink={first.sink}>{renderMessage(spec("dec_123e4567-e89b-42d3-a456-426614174000", "First", "notice1"), "fallback")}</CaptureProvider>
      <CaptureProvider sink={second.sink}>{renderMessage(spec("dec_223e4567-e89b-42d3-a456-426614174000", "Second", "notice2"), "fallback")}</CaptureProvider>
    </>);

    await passTime(0);
    const notices = screen.getAllByRole("status");
    expect(notices).toHaveLength(2);
    expect(document.querySelectorAll("[data-sonner-toaster]")).toHaveLength(1);
    expect(document.querySelectorAll("[data-sonner-toast]")).toHaveLength(2);
    for (const observer of TestIntersectionObserver.instances) act(() => observer.setRatio(1));
    await passTime(0);
    expect(first.events).toContainEqual({ name: "change_shown", decision_id: "dec_123e4567-e89b-42d3-a456-426614174000" });
    expect(second.events).toContainEqual({ name: "change_shown", decision_id: "dec_223e4567-e89b-42d3-a456-426614174000" });
    act(() => { notices.find((notice) => notice.textContent?.includes("First"))!.querySelector("button")!.click(); });
    expect(first.events).toContainEqual({ name: "change_kept", decision_id: "dec_123e4567-e89b-42d3-a456-426614174000" });
    expect(second.events.some(({ name }) => name === "change_kept")).toBe(false);
  });

  it("emits change_shown for an inline ChangeNotice only after it becomes visible", async () => {
    const capture = recordingCapture();
    let visibleWhenShown = false;
    const sink = (event: Parameters<typeof capture.sink>[0]) => {
      capture.sink(event);
      if (event.name === "change_shown") visibleWhenShown = screen.getByRole("status", { name: "Changed" }).checkVisibility({ opacityProperty: true, visibilityProperty: true });
    };
    const notice = <ChangeNotice decision_id="dec_123e4567-e89b-42d3-a456-426614174000" title="Changed" reason="Because." presentation="inline" />;
    const view = render(<CaptureProvider sink={sink}><div style={{ display: "none" }}>{notice}</div></CaptureProvider>);
    await passTime(100);
    expect(capture.events.some(({ name }) => name === "change_shown")).toBe(false);

    view.rerender(<CaptureProvider sink={sink}><div>{notice}</div></CaptureProvider>);
    act(() => TestIntersectionObserver.instances.at(-1)!.setRatio(1));
    await passTime(100);
    expect(capture.events).toContainEqual({ name: "change_shown", decision_id: "dec_123e4567-e89b-42d3-a456-426614174000" });
    expect(visibleWhenShown).toBe(true);
  });

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
    const view = render(<CaptureProvider sink={capture.sink}><ChangeNoticeToastHost /><ChangeNotice decision_id="dec_123e4567-e89b-42d3-a456-426614174000" title="Changed" reason="Because." presentation="toast" /></CaptureProvider>);
    await passTime(0);
    const notice = screen.getByRole("status", { name: "Changed" });
    const observer = TestIntersectionObserver.instances.at(-1)!;
    expect(observer.target).toBe(notice);
    const toast = notice.closest("[data-sonner-toast]");
    expect(toast).toBeTruthy();
    toast!.setAttribute("style", "display: none");
    view.rerender(<CaptureProvider sink={capture.sink}><ChangeNoticeToastHost /><ChangeNotice decision_id="dec_123e4567-e89b-42d3-a456-426614174000" title="Changed" reason="Because." presentation="toast" onKeep={() => undefined} /></CaptureProvider>);
    expect(document.querySelector('[role="status"]')).toBe(notice);
    expect(observer.target).toBe(notice);
    act(() => observer.setRatio(1));
    await passTime(3500);
    expect(capture.events.some(({ name }) => name === "component_seen")).toBe(false);
    expect(capture.events.some(({ name }) => name === "change_shown")).toBe(false);

    toast!.removeAttribute("style");
    act(() => observer.setRatio(1));
    await passTime(3300);
    expect(capture.events).toContainEqual({ name: "change_shown", decision_id: "dec_123e4567-e89b-42d3-a456-426614174000" });
    expect(capture.events.filter(({ name }) => name === "component_seen")).toEqual([
      { name: "component_seen", component: "ChangeNotice", default_state: "toast", seconds_visible: 3 },
    ]);
  });
});
