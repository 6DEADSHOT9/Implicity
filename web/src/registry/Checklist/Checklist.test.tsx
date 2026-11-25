// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { CaptureProvider, recordingCapture } from "../capture";
import { registry } from "../index";
import { propsSchema } from "./schema";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Checklist public registry entry", () => {
 const entry = registry.getSkeleton("Checklist")!;
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
  expect(recorder.events[0]).toEqual({ name: "component_shown", component: "Checklist", default_state: "default" });
  act(() => vi.advanceTimersByTime(3000));
  expect(recorder.events[1]).toEqual({ name: "component_seen", component: "Checklist", default_state: "default", seconds_visible: 3 });
  act(() => root.unmount());
 });

 it("leaves checklist changes to the host callback", () => {
  const onAction = vi.fn();
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<entry.Component props={entry.meta.galleryStates[0].props} slots={{}} onAction={onAction} />));
  act(() => (host.querySelector("[role=checkbox]") as HTMLButtonElement).click());
  expect(onAction).toHaveBeenCalledWith("checklist_toggle", 0);
  act(() => root.unmount());
 });
 it("uses unique per-instance ids and associates each label with its checkbox", () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const state = entry.meta.galleryStates[0].props;
  const firstAction = vi.fn();
  const secondAction = vi.fn();
  act(() => root.render(<><entry.Component props={state} slots={{}} onAction={firstAction} /><entry.Component props={state} slots={{}} onAction={secondAction} /></>));
  const checkboxes = [...host.querySelectorAll("[role=checkbox]")];
  const ids = checkboxes.map((checkbox) => checkbox.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const checkbox of checkboxes) expect(host.querySelector(`label[for="${checkbox.id}"]`)).not.toBeNull();
  act(() => (host.querySelectorAll("label")[2] as HTMLLabelElement).click());
  expect(firstAction).not.toHaveBeenCalled();
  expect(secondAction).toHaveBeenCalledWith("checklist_toggle", 0);
  act(() => root.unmount());
 });
 it("keeps the primary content accessible", () => {
  const markup = renderToStaticMarkup(<entry.Component props={entry.meta.galleryStates[0].props} slots={{}} />);
    expect(markup).toContain('type="checkbox"');
  expect(markup).toContain('data-slot="label"');
  expect(markup).toContain('checked=""');
 });
});
