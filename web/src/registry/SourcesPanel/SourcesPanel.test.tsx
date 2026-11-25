// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture } from "../capture";
import { SourcesPanel } from "./SourcesPanel";
import { events } from "./events";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";

afterEach(() => vi.useRealTimers());

describe("SourcesPanel public interface", () => {
  it("renders populated and empty gallery states", () => {
    const populated = render(<SourcesPanel {...meta.galleryStates[0].props} />);
    expect(screen.getByRole("button", { name: "Sources (2)" })).toBeTruthy();
    expect(screen.getByText("Reference one")).toBeTruthy();
    populated.unmount();
    render(<SourcesPanel {...meta.galleryStates[1].props} />);
    expect(screen.getByRole("status").textContent).toContain("No sources");
  });

  it("validates props, declares only contract events, and tracks disclosure state", async () => {
    expect(propsSchema.safeParse(meta.galleryStates[0].props).success).toBe(true);
    expect(propsSchema.safeParse({ sources: [{ title: "x", type: "filename" }] }).success).toBe(false);
    expect(slotsSchema.safeParse({}).success).toBe(true);
    expect(events).toEqual(["component_shown", "component_seen", "panel_opened", "panel_closed"]);

    const user = userEvent.setup();
    const recorder = recordingCapture();
    const onOpenChange = vi.fn();
    render(<CaptureProvider sink={recorder.sink}><SourcesPanel {...meta.galleryStates[0].props} onOpenChange={onOpenChange} /></CaptureProvider>);
    expect(recorder.events[0]).toEqual({ name: "component_shown", component: "SourcesPanel", default_state: "populated" });
    expect(screen.getByText("Reference one")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Sources (2)" }));
    expect(screen.queryByText("Reference one")).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(recorder.events.at(-1)).toEqual({ name: "panel_closed", component: "SourcesPanel" });
    await user.click(screen.getByRole("button", { name: "Sources (2)" }));
    expect(screen.getByText("Reference one")).toBeTruthy();
    expect(recorder.events.at(-1)).toEqual({ name: "panel_opened", component: "SourcesPanel" });
  });

  it("emits seen after the panel remains rendered", async () => {
    vi.useFakeTimers();
    const recorder = recordingCapture();
    render(<CaptureProvider sink={recorder.sink}><SourcesPanel {...meta.galleryStates[0].props} /></CaptureProvider>);
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(recorder.events.at(-1)).toEqual({ name: "component_seen", component: "SourcesPanel", default_state: "populated", seconds_visible: 3 });
  });
});
