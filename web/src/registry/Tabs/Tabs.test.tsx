// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { CaptureProvider, recordingCapture } from "../capture";
import { registry } from "../index";
import { propsSchema } from "./schema";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Tabs public registry entry", () => {
 const entry = registry.getSkeleton("Tabs")!;
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
   observe() { observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
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
  expect(recorder.events[0]).toEqual({ name: "component_shown", component: "Tabs", default_state: "default" });
  act(() => vi.advanceTimersByTime(3000));
  expect(recorder.events[1]).toEqual({ name: "component_seen", component: "Tabs", default_state: "default", seconds_visible: 3 });
  act(() => root.unmount());
 });

 it("leaves tab selection to the host callback", () => {
  const onAction = vi.fn();
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<entry.Component props={entry.meta.galleryStates[0].props} slots={{}} onAction={onAction} />));
  act(() => (host.querySelectorAll("[role=tab]")[1] as HTMLButtonElement).click());
  expect(onAction).toHaveBeenCalledWith("tab_select", "details");
  act(() => root.unmount());
 });

 it("supports arrow-key tab navigation", () => {
  const onAction = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<entry.Component props={entry.meta.galleryStates[0].props} slots={{}} onAction={onAction} />));
  const firstTab = host.querySelector("[role=tab]") as HTMLButtonElement;
  act(() => firstTab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
  expect(onAction).toHaveBeenCalledWith("tab_select", "details");
  act(() => root.unmount());
  host.remove();
 });
 it("keeps the primary content accessible", () => {
  const markup = renderToStaticMarkup(<entry.Component props={entry.meta.galleryStates[0].props} slots={{}} />);
    expect(markup).toContain('role="tablist"');
  expect(markup).toContain('role="tab"');
  expect(markup).toContain('role="tabpanel"');
 });
});
