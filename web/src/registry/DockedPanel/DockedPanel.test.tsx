// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DockedPanel } from "./DockedPanel";
import { propsSchema, slotsSchema } from "./schema";
import { events } from "./events";
import { meta } from "./meta";
import { CaptureProvider, recordingCapture } from "../capture";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.useRealTimers());

describe("DockedPanel public interface", () => {
  it("renders each gallery state with accessible tabs", () => {
    for (const state of meta.galleryStates) {
      const html = renderToStaticMarkup(<DockedPanel {...state.props} slots={{ main: state.slots?.main?.map((slot) => <p key={slot}>{slot}</p>) }} />);
      if (state.id !== "closed") expect(html).toContain('role="group"');
    }
  });
  it("validates declared props and slots and uses only panel event vocabulary", () => {
    expect(propsSchema.safeParse(meta.galleryStates[0].props).success).toBe(true);
    expect(propsSchema.safeParse({ ...meta.galleryStates[0].props, extra: true }).success).toBe(false);
    expect(slotsSchema.safeParse({ main: ["panel_content"] }).success).toBe(true);
    expect(events).toEqual(["component_shown", "component_seen", "panel_opened", "panel_closed", "panel_docked", "panel_undocked"]);
  });
  it("emits declared lifecycle and panel events and calls app callbacks", async () => {
    vi.useFakeTimers();
    const recorder = recordingCapture();
    const onOpenChange = vi.fn();
    const onDockChange = vi.fn();
    const onTabChange = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<CaptureProvider sink={recorder.sink}><DockedPanel {...meta.galleryStates[0].props} onOpenChange={onOpenChange} onDockChange={onDockChange} onTabChange={onTabChange} /></CaptureProvider>));
    expect(recorder.events).toEqual([{ name: "component_shown", component: "DockedPanel", default_state: "open_docked" }]);
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(recorder.events[1]).toEqual({ name: "component_seen", component: "DockedPanel", default_state: "open_docked", seconds_visible: 3 });
    const buttons = container.querySelectorAll("button");
    await act(async () => { buttons[0].click(); buttons[1].click(); buttons[3].click(); });
    expect(onTabChange).toHaveBeenCalledWith("History");
    expect(onDockChange).toHaveBeenCalledWith(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(recorder.events.slice(2)).toEqual([
      { name: "panel_undocked", component: "DockedPanel" },
      { name: "panel_closed", component: "DockedPanel" },
    ]);
    await act(async () => root.unmount());
  });
});
