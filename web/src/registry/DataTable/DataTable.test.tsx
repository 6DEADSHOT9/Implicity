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
  expect(propsSchema.safeParse({ columns: ["Name", "Value"], rows: [["Loss", "-1"]], chartValues: [-1, 2] }).success).toBe(false);
  expect(entry.events).toEqual(["component_shown", "component_seen", "representation_switched"]);
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
  expect(recorder.events[0]).toEqual({ name: "component_shown", component: "DataTable", default_state: "table" });
  act(() => vi.advanceTimersByTime(3000));
  expect(recorder.events[1]).toEqual({ name: "component_seen", component: "DataTable", default_state: "table", seconds_visible: 3 });
  act(() => root.unmount());
 });
 it("records a switch only after the displayed representation changes", () => {
  const recorder = recordingCapture();
  const host = document.createElement("div");
  const root = createRoot(host);
  const onAction = vi.fn();
  act(() => root.render(<CaptureProvider sink={recorder.sink}><entry.Component props={entry.meta.galleryStates[0].props} slots={{}} onAction={onAction} /></CaptureProvider>));
  act(() => (host.querySelectorAll("button")[1] as HTMLButtonElement).click());
  expect(onAction).toHaveBeenCalledWith("representation", "chart");
  expect(recorder.events.some(({ name }) => name === "representation_switched")).toBe(false);
  act(() => root.render(<CaptureProvider sink={recorder.sink}><entry.Component props={{ ...entry.meta.galleryStates[0].props, form: "chart" }} slots={{}} onAction={onAction} /></CaptureProvider>));
  expect(recorder.events).toContainEqual({ name: "representation_switched", dimension: "data_form", from: "table", to: "chart" });
  act(() => root.unmount());
 });
 it("does not record representation changes while no representation is displayed", () => {
  const recorder = recordingCapture();
  const host = document.createElement("div");
  const root = createRoot(host);
  const render = (props: Record<string, unknown>) => <CaptureProvider sink={recorder.sink}><entry.Component props={props} slots={{}} /></CaptureProvider>;
  const base = entry.meta.galleryStates[0].props;
  act(() => root.render(render({ ...base, state: "error" })));
  expect(recorder.events[0]).toEqual({ name: "component_shown", component: "DataTable", default_state: "error" });
  act(() => root.render(render({ ...base, form: "chart", state: "error" })));
  expect(recorder.events.some(({ name }) => name === "representation_switched")).toBe(false);
  act(() => root.render(render({ ...base, form: "chart" })));
  expect(recorder.events.some(({ name }) => name === "representation_switched")).toBe(false);
  act(() => root.render(render({ ...base, form: "table" })));
  act(() => root.render(render({ ...base, form: "chart" })));
  expect(recorder.events).toContainEqual({ name: "representation_switched", dimension: "data_form", from: "table", to: "chart" });
  act(() => root.unmount());
 });
 it("renders signed chart values without clamping them to progress", () => {
  const state = { props: { columns: ["Name", "Value"], rows: [["Loss", "-10"], ["Flat", "0"], ["Gain", "10"]], chartValues: [-10, 0, 10], form: "chart" }, slots: {} };
  const markup = renderToStaticMarkup(<entry.Component props={state.props} slots={state.slots} />);
  expect(markup).toContain("Loss: -10");
  expect(markup).toContain("Flat: 0");
  expect(markup).toContain("Gain: 10");
  expect(markup).not.toContain('data-slot="progress"');
 });
 it("keeps the primary content accessible", () => {
  const markup = renderToStaticMarkup(<entry.Component props={entry.meta.galleryStates[0].props} slots={{}} />);
    expect(markup).toContain('data-slot="table"');
    expect(markup).not.toContain('data-slot="card"');
  expect(markup).toContain('scope="col"');
  expect(markup).toContain('aria-label="Data representation"');
 });
});
