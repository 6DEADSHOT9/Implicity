// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { CaptureProvider, recordingCapture } from "../capture";
import { registry } from "../index";
import { propsSchema } from "./schema";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("DataTable public registry entry", () => {
 const entry = registry.getSkeleton("DataTable")!;
 it("renders each declared gallery state", () => {
  for (const state of entry.meta.galleryStates) expect(renderToStaticMarkup(<entry.Component props={state.props} slots={{}} />)).not.toBe("");
 });
 it("validates props and declares only its supported events", () => {
  expect(propsSchema.safeParse(entry.meta.galleryStates[0].props).success).toBe(true);
  expect(propsSchema.safeParse({ unexpected: true }).success).toBe(false);
  expect(entry.events).toEqual(["component_shown", "component_seen", "representation_switched"]);
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
  expect(recorder.events[0]).toEqual({ name: "component_shown", component: "DataTable", default_state: "default" });
  act(() => vi.advanceTimersByTime(3000));
  expect(recorder.events[1]).toEqual({ name: "component_seen", component: "DataTable", default_state: "default", seconds_visible: 3 });
  act(() => root.unmount());
 });
 it("emits a closed-vocabulary event when the representation changes", () => {
  const recorder = recordingCapture();
  const host = document.createElement("div");
  const root = createRoot(host);
  const onAction = vi.fn();
  act(() => root.render(<CaptureProvider sink={recorder.sink}><entry.Component props={entry.meta.galleryStates[0].props} slots={{}} onAction={onAction} /></CaptureProvider>));
  act(() => (host.querySelectorAll("button")[1] as HTMLButtonElement).click());
  expect(onAction).toHaveBeenCalledWith("representation", "chart");
  expect(recorder.events.at(-1)).toEqual({ name: "representation_switched", dimension: "data_form", from: "table", to: "chart" });
  act(() => root.unmount());
 });
 it("keeps the primary content accessible", () => {
  const markup = renderToStaticMarkup(<entry.Component props={entry.meta.galleryStates[0].props} slots={{}} />);
    expect(markup).toContain('role="region"');
  expect(markup).toContain('scope="col"');
  expect(markup).toContain('role="group"');
 });
});
