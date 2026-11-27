// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { getSingletonHighlighter } from "shiki";
import { CaptureProvider, recordingCapture } from "../capture";
import { registry } from "../index";
import { propsSchema } from "./schema";

vi.mock("shiki", { spy: true });

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
  expect(recorder.events[0]).toEqual({ name: "component_shown", component: "CodeBlock", default_state: "code" });
  act(() => vi.advanceTimersByTime(3000));
  expect(recorder.events[1]).toEqual({ name: "component_seen", component: "CodeBlock", default_state: "code", seconds_visible: 3 });
  act(() => root.unmount());
 });
 it("keeps the primary content accessible", () => {
  const markup = renderToStaticMarkup(<entry.Component props={entry.meta.galleryStates[0].props} slots={{}} />);
  expect(markup).toContain('data-slot="code-block"');
  expect(markup).toContain('data-slot="code-block-header"');
  expect(markup).toContain('data-slot="code-block-content"');
  expect(markup).toContain('data-language="javascript"');
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
 it("shows the error state before every variant", () => {
  for (const variant of ["code", "diff", "stack_trace", "terminal"] as const) {
   const markup = renderToStaticMarkup(<entry.Component props={{ code: "failure", variant, state: "error" }} slots={{}} />);
   expect(markup).toContain('role="alert"');
   expect(markup).toContain("Code could not be loaded");
   expect(markup).not.toContain("failure");
  }
 });
 it("loads a grammar only for highlighted code", async () => {
  const highlighter = vi.mocked(getSingletonHighlighter);
  highlighter.mockClear();
  const root = createRoot(document.createElement("div"));
  try {
   const terminal = entry.meta.galleryStates.find(({ id }) => id === "terminal_long")!;
   await act(async () => root.render(<entry.Component props={terminal.props} slots={{}} />));
   expect(highlighter).not.toHaveBeenCalled();

   const code = entry.meta.galleryStates.find(({ id }) => id === "code")!;
   await act(async () => root.render(<entry.Component props={code.props} slots={{}} />));
   expect(highlighter).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ langs: ["javascript"] }));
   await act(async () => { await highlighter.mock.results[0].value; });
  } finally {
   await act(async () => root.unmount());
  }
 });
 it("keeps long terminal output in the primitive's scroll region", () => {
  const markup = renderToStaticMarkup(<entry.Component props={{ code: Array.from({ length: 200 }, (_, index) => `line ${index + 1}`).join("\n"), language: "text", variant: "terminal" }} slots={{}} />);
  expect(markup).toContain("max-h-content-height overflow-auto");
  expect(markup).toContain('tabindex="0"');
  expect(markup).toContain("line 200");
 });
});
