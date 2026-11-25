// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import userEvent from "@testing-library/user-event";
import { CaptureProvider, recordingCapture } from "../capture";
import { registry } from "../index";
import { propsSchema, slotsSchema } from "./schema";

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
  const base = { tabs: [{ id: "summary", label: "Summary" }], selected: "summary" };
  expect(propsSchema.safeParse(base).success).toBe(true);
  expect(propsSchema.safeParse({ ...base, tabs: [{ id: "Bad ID", label: "Bad" }] }).success).toBe(false);
  expect(propsSchema.safeParse({ ...base, tabs: [...base.tabs, ...base.tabs] }).success).toBe(false);
  expect(propsSchema.safeParse({ ...base, selected: "missing" }).success).toBe(false);
  expect(slotsSchema.safeParse({ "Bad ID": [] }).success).toBe(false);
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
  expect(recorder.events[0]).toEqual({ name: "component_shown", component: "Tabs", default_state: "overview" });
  act(() => vi.advanceTimersByTime(3000));
  expect(recorder.events[1]).toEqual({ name: "component_seen", component: "Tabs", default_state: "overview", seconds_visible: 3 });
  act(() => root.unmount());
 });

 it("leaves tab selection to the host callback", async () => {
  const onAction = vi.fn();
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<entry.Component props={entry.meta.galleryStates[0].props} slots={{}} onAction={onAction} />));
  await userEvent.setup().click(host.querySelectorAll("[role=tab]")[1] as HTMLButtonElement);
  expect(onAction).toHaveBeenCalledWith("tab_select", "details");
  act(() => root.unmount());
 });

 it("supports arrow-key tab navigation", async () => {
  const onAction = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<entry.Component props={entry.meta.galleryStates[0].props} slots={{}} onAction={onAction} />));
  const firstTab = host.querySelector("[role=tab]") as HTMLButtonElement;
  await userEvent.setup().click(firstTab);
  await userEvent.setup().keyboard("{ArrowRight}");
  expect(onAction).toHaveBeenCalledWith("tab_select", "details");
  act(() => root.unmount());
  host.remove();
 });
 it("renders each tab's named slot content", () => {
  const markup = renderToStaticMarkup(<entry.Component props={{ tabs: [{ id: "summary", label: "Summary" }], selected: "summary" }} slots={{ summary: ["slot child"] }} />);
  expect(markup).toContain("slot child");
 });
 it("keeps the primary content accessible", () => {
  const markup = renderToStaticMarkup(<entry.Component props={entry.meta.galleryStates[0].props} slots={{}} />);
    expect(markup).toContain('role="tablist"');
  expect(markup).toContain('role="tab"');
  expect(markup).toContain('role="tabpanel"');
 });
});
