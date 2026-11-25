// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { CaptureProvider, recordingCapture } from "../capture";
import { registry } from "../index";
import { propsSchema } from "./schema";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("CodeBlock public registry entry", () => {
 const entry = registry.getSkeleton("CodeBlock")!;
 it("renders each declared gallery state", () => {
  for (const state of entry.meta.galleryStates) expect(renderToStaticMarkup(<entry.Component props={state.props} slots={{}} />)).not.toBe("");
 });
 it("validates props and declares only its supported events", () => {
  expect(propsSchema.safeParse(entry.meta.galleryStates[0].props).success).toBe(true);
  expect(propsSchema.safeParse({ unexpected: true }).success).toBe(false);
  expect(entry.events).toEqual(["component_shown", "component_seen"]);
 });

 it("emits lifecycle events through the capture provider", () => {
  let observerCallback: IntersectionObserverCallback | undefined;
  class ObserverMock {
   constructor(callback: IntersectionObserverCallback) { observerCallback = callback; }
   observe(target: Element) {
    Object.defineProperty(target, "checkVisibility", { configurable: true, value: () => true });
    observerCallback?.([{ target, isIntersecting: true, intersectionRatio: 1, time: performance.now() } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
   }
   disconnect() {}
   unobserve() {}
   takeRecords() { return []; }
  }
  vi.stubGlobal("IntersectionObserver", ObserverMock);
  vi.useFakeTimers();
  const recorder = recordingCapture();
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<CaptureProvider sink={recorder.sink}><entry.Component props={entry.meta.galleryStates[0].props} slots={{}} /></CaptureProvider>));
  expect(recorder.events[0]).toEqual({ name: "component_shown", component: "CodeBlock", default_state: "default" });
  act(() => vi.advanceTimersByTime(3000));
  expect(recorder.events[1]).toEqual({ name: "component_seen", component: "CodeBlock", default_state: "default", seconds_visible: 3 });
  act(() => root.unmount());
 });
 it("keeps the primary content accessible", () => {
  const markup = renderToStaticMarkup(<entry.Component props={entry.meta.galleryStates[0].props} slots={{}} />);
  expect(markup).toContain('data-slot="code-block"');
  expect(markup).toContain('<pre');
  expect(markup).toContain('tabindex="0"');
  expect(markup).toContain('aria-label="javascript code"');
 });
 it("uses readable Stack Trace surfaces and presents inactive paths as text", () => {
  const state = entry.meta.galleryStates.find(({ id }) => id === "stack_trace")!;
  const markup = renderToStaticMarkup(<entry.Component props={state.props} slots={{}} />);
  expect(markup).toContain("bg-code-background");
  expect(markup).toContain("text-code-foreground");
  expect(markup).toContain("src/view.ts:12:4");
  expect(markup).not.toContain("disabled=");
 });
});
