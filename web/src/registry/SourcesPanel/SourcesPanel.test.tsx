// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SourcesPanel } from "./SourcesPanel";
import { propsSchema, slotsSchema } from "./schema";
import { events } from "./events";
import { meta } from "./meta";
import { CaptureProvider, recordingCapture } from "../capture";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.useRealTimers());

describe("SourcesPanel public interface", () => {
  it("renders every gallery state with an accessible empty state or source list", () => {
    for (const state of meta.galleryStates) {
      const html = renderToStaticMarkup(<SourcesPanel {...state.props} />);
      expect(html).toContain("Sources");
      expect(html).toMatch(state.id === "empty" ? /role="status"/ : /<li/);
    }
  });
  it("validates props and declares only closed panel events", () => {
    expect(propsSchema.safeParse(meta.galleryStates[0].props).success).toBe(true);
    expect(propsSchema.safeParse({ sources: [{ title: "x", type: "filename" }] }).success).toBe(false);
    expect(slotsSchema.safeParse({}).success).toBe(true);
    expect(events).toEqual(["component_shown", "component_seen"]);
  });
  it("emits lifecycle events with the source panel state and no content", async () => {
    vi.useFakeTimers();
    const recorder = recordingCapture();
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(<CaptureProvider sink={recorder.sink}><SourcesPanel {...meta.galleryStates[0].props} /></CaptureProvider>));
    expect(recorder.events).toEqual([{ name: "component_shown", component: "SourcesPanel", default_state: "populated" }]);
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(recorder.events[1]).toEqual({ name: "component_seen", component: "SourcesPanel", default_state: "populated", seconds_visible: 3 });
    expect(JSON.stringify(recorder.events)).not.toContain("Reference one");
    await act(async () => root.unmount());
  });
});
