// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { CaptureProvider, recordingCapture } from "../capture";
import { registry } from "../index";
import { DataTable } from "./DataTable";
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
 it("renders blank and repeated headers, every cell, and leaves values in input order", () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<entry.Component props={{ columns: ["", "Cost", "Cost"], rows: [["Plan", "10", "99", "extra"], ["B", "9", "100", "kept"], ["Short"]] }} slots={{}} />));
  expect(Array.from(host.querySelectorAll("thead th"), (cell) => cell.textContent)).toEqual(["", "Cost", "Cost"]);
  expect(Array.from(host.querySelectorAll("tbody tr"), (row) => row.textContent)).toEqual(["Plan1099extra", "B9100kept", "Short"]);
  expect(Array.from(host.querySelectorAll("tbody tr"), (row) => row.querySelectorAll("td").length)).toEqual([4, 4, 3]);
  expect(host.querySelector("thead button")).toBeNull();
  act(() => root.unmount());
 });

 it("does not offer misleading lexicographic numeric sorting", () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<entry.Component props={{ columns: ["Value"], rows: [["9"], ["10"], ["100"], ["$900"], ["$1,200"], ["$80"], ["-1.5"], ["-10"], ["2"]] }} slots={{}} />));
  expect(Array.from(host.querySelectorAll("tbody tr"), (row) => row.textContent)).toEqual(["9", "10", "100", "$900", "$1,200", "$80", "-1.5", "-10", "2"]);
  expect(host.querySelector("thead button")).toBeNull();
  act(() => root.unmount());
 });

 it("emits only a state declared by DataTable for empty defaults and unavailable charts", () => {
  const recorder = recordingCapture();
  const host = document.createElement("div");
  let root = createRoot(host);
  const declared = new Set(entry.meta.defaultStates);
  for (const props of [
    { columns: [], rows: [] },
    { columns: ["A"], rows: [["1"]], form: "chart" },
  ]) {
    act(() => root.unmount());
    recorder.events.length = 0;
    root = createRoot(host);
    act(() => root.render(<CaptureProvider sink={recorder.sink}><entry.Component props={props} slots={{}} /></CaptureProvider>));
    const event = recorder.events.at(-1);
    if (!event || event.name !== "component_shown") throw new Error("Expected DataTable to emit component_shown");
    expect(declared.has(event.default_state)).toBe(true);
    expect(event.default_state).toBe("empty");
  }
  act(() => root.unmount());
 });
 it("keeps ordinary empty tables empty and shows headers for Markdown tables", () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const recorder = recordingCapture();
  act(() => root.render(<CaptureProvider sink={recorder.sink}><entry.Component props={{ columns: ["Name", "Value"], rows: [], form: "table" }} slots={{}} /></CaptureProvider>));
  expect(host.textContent).toContain("No data");
  expect(recorder.events).toContainEqual({ name: "component_shown", component: "DataTable", default_state: "empty" });
  act(() => root.render(<DataTable columns={["Name", "Value"]} rows={[]} renderedColumns={["Name", "Value"]} showEmptyHeaders form="table" state="default" />));
  expect(Array.from(host.querySelectorAll("thead th"), (cell) => cell.textContent)).toEqual(["Name", "Value"]);
  act(() => root.unmount());
 });

 it("shows the representation switcher only when another representation exists", () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const onAction = vi.fn();
  act(() => root.render(<entry.Component props={{ columns: ["Name"], rows: [["A"]], form: "table" }} slots={{}} onAction={onAction} />));
  expect(host.querySelector('[aria-label="Data representation"]')).toBeNull();
  act(() => root.render(<entry.Component props={{ columns: ["Name"], rows: [["A"]], chartValues: [1], form: "chart" }} slots={{}} onAction={onAction} />));
  expect(host.querySelector('[aria-label="Data representation"]')).toBeTruthy();
  act(() => (host.querySelector('[aria-label="Data representation"] button') as HTMLButtonElement).click());
  expect(onAction).toHaveBeenCalledWith("representation", "table");
  act(() => root.render(<entry.Component props={{ columns: ["Name"], rows: [["A"]], chartValues: [1], form: "chart" }} slots={{}} onAction={onAction} />));
  expect(host.textContent).toContain("A: 1");
  expect(host.querySelector('[aria-label="Data representation"]')).toBeTruthy();
  act(() => root.unmount());
 });

 it("does not report a switch between empty screens even when chart values exist", () => {
  const recorder = recordingCapture();
  const host = document.createElement("div");
  const root = createRoot(host);
  const render = (form: "table" | "chart") => <CaptureProvider sink={recorder.sink}><entry.Component props={{ columns: ["Name"], rows: [], chartValues: [], form }} slots={{}} /></CaptureProvider>;
  act(() => root.render(render("table")));
  act(() => root.render(render("chart")));
  expect(host.textContent).toContain("No data");
  expect(recorder.events.some(({ name }) => name === "representation_switched")).toBe(false);
  act(() => root.unmount());
 });
 it("keeps the primary content accessible", () => {
  const markup = renderToStaticMarkup(<entry.Component props={entry.meta.galleryStates[0].props} slots={{}} />);
    expect(markup).toContain('data-slot="table"');
    expect(markup).not.toContain('data-slot="card"');
  expect(markup).toContain('scope="col"');
  expect(markup).toContain('aria-label="Data representation"');
 });
});
