// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture } from "../capture";
import { SourcesPanel } from "./SourcesPanel";
import { events } from "./events";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";

describe("SourcesPanel public interface", () => {
  it("accepts the documented docked layout and renders closed and docked examples", () => {
    expect(propsSchema.safeParse({ docked: true }).success).toBe(true);
    expect(slotsSchema.safeParse({}).success).toBe(true);
    const closed = render(<SourcesPanel {...meta.galleryStates[1].props} />);
    expect(screen.getByRole("button", { name: "Sources (0)" }).getAttribute("data-state")).toBe("closed");
    closed.unmount();
    render(<SourcesPanel {...meta.galleryStates[0].props} />);
    expect(screen.getByRole("button", { name: "Sources (2)" }).getAttribute("data-state")).toBe("open");
    expect(screen.getByText("Reference one")).toBeTruthy();
    expect(screen.getByText("Reference two")).toBeTruthy();
  });

  it("calls the controlled callback and emits only after the docked prop changes", async () => {
    const user = userEvent.setup();
    const recorder = recordingCapture();
    const onDockChange = vi.fn();
    const view = render(<CaptureProvider sink={recorder.sink}><SourcesPanel {...meta.galleryStates[0].props} onDockChange={onDockChange} /></CaptureProvider>);
    expect(recorder.events).toEqual([{ name: "component_shown", component: "SourcesPanel", default_state: "docked" }]);
    await user.click(screen.getByRole("button", { name: "Sources (2)" }));
    expect(onDockChange).toHaveBeenCalledWith(false);
    expect(recorder.events).toHaveLength(1);
    view.rerender(<CaptureProvider sink={recorder.sink}><SourcesPanel docked={false} sources={meta.galleryStates[0].props.sources} onDockChange={onDockChange} /></CaptureProvider>);
    expect(recorder.events.at(-1)).toEqual({ name: "panel_closed", component: "SourcesPanel" });
    expect(screen.queryByText("Reference one")).toBeNull();
    expect(events).toEqual(["component_shown", "component_seen", "panel_opened", "panel_closed"]);
  });
});
