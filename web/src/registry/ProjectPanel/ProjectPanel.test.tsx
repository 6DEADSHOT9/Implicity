// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectPanel } from "./ProjectPanel";
import { propsSchema, slotsSchema } from "./schema";
import { events } from "./events";
import { meta } from "./meta";
import { CaptureProvider, recordingCapture } from "../capture";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.useRealTimers());

describe("ProjectPanel public interface", () => {
  it("renders each declared state and exposes the selected tab", () => {
    for (const state of meta.galleryStates) {
      const html = renderToStaticMarkup(<ProjectPanel {...state.props} slots={Object.fromEntries(Object.entries(state.slots ?? {}).map(([slot, ids]) => [slot, (ids as readonly string[]).map((id) => <p key={id}>{id}</p>)]))} />);
      expect(html).toContain('role="group"');
      expect(html).toContain(`aria-label="${state.id}"`);
    }
  });
  it("validates props and all declared slot ids and panel events", () => {
    const state = meta.galleryStates[0];
    expect(propsSchema.safeParse(state.props).success).toBe(true);
    expect(propsSchema.safeParse({ ...state.props, activeTab: "other" }).success).toBe(false);
    expect(slotsSchema.safeParse(state.slots).success).toBe(true);
    expect(slotsSchema.safeParse({ ...state.slots, files: ["BadId"] }).success).toBe(false);
    expect(events).toEqual(["component_shown", "component_seen"]);
  });
  it("emits lifecycle events and delegates tab selection", async () => {
    vi.useFakeTimers();
    const recorder = recordingCapture();
    const onTabChange = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<CaptureProvider sink={recorder.sink}><ProjectPanel {...meta.galleryStates[0].props} onTabChange={onTabChange} /></CaptureProvider>));
    expect(recorder.events).toEqual([{ name: "component_shown", component: "ProjectPanel", default_state: "decisions" }]);
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(recorder.events[1]).toEqual({ name: "component_seen", component: "ProjectPanel", default_state: "decisions", seconds_visible: 3 });
    await act(async () => { container.querySelectorAll("button")[1].click(); });
    expect(onTabChange).toHaveBeenCalledWith("constraints");
    await act(async () => root.unmount());
  });
});
