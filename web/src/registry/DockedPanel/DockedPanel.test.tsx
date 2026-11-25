// @vitest-environment jsdom
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture } from "../capture";
import { DockedPanel } from "./DockedPanel";
import { events } from "./events";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));

afterEach(() => vi.useRealTimers());

describe("DockedPanel public interface", () => {
  it("renders its docked state with an accessible mobile Sheet and Tabs", () => {
    render(<DockedPanel {...meta.galleryStates[0].props} slots={{ main: [<p key="content">panel content</p>] }} />);
    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Workspace" })).toBeTruthy();
  });

  it("renders the undocked state in an accessible Sheet overlay", () => {
    render(<DockedPanel {...meta.galleryStates[1].props} />);
    expect(screen.getByRole("dialog", { name: "Workspace" })).toBeTruthy();
  });

  it("renders the closed state with an open control", () => {
    render(<DockedPanel {...meta.galleryStates[2].props} />);
    expect(screen.getByRole("button", { name: "Open Workspace" })).toBeTruthy();
  });

  it("validates props and slots and uses only declared event vocabulary", () => {
    expect(propsSchema.safeParse(meta.galleryStates[0].props).success).toBe(true);
    expect(propsSchema.safeParse({ ...meta.galleryStates[0].props, extra: true }).success).toBe(false);
    expect(slotsSchema.safeParse({ main: ["panel_content"] }).success).toBe(true);
    expect(events).toEqual(["component_shown", "component_seen", "panel_opened", "panel_closed", "panel_docked", "panel_undocked"]);
  });

  it("keeps Tabs keyboard-operable and emits panel and lifecycle events", async () => {
    const user = userEvent.setup();
    const recorder = recordingCapture();
    const onOpenChange = vi.fn();
    const onDockChange = vi.fn();
    const onTabChange = vi.fn();
    render(<CaptureProvider sink={recorder.sink}><DockedPanel {...meta.galleryStates[0].props} onOpenChange={onOpenChange} onDockChange={onDockChange} onTabChange={onTabChange} /></CaptureProvider>);
    expect(recorder.events[0]).toEqual({ name: "component_shown", component: "DockedPanel", default_state: "open_docked" });
    screen.getByRole("tab", { name: "Details" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onTabChange).toHaveBeenCalledWith("History");
    await user.click(screen.getByRole("button", { name: "Undock" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onDockChange).toHaveBeenCalledWith(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(recorder.events.slice(1)).toEqual([
      { name: "panel_undocked", component: "DockedPanel" },
      { name: "panel_closed", component: "DockedPanel" },
    ]);
  });

  it("emits seen after the panel remains rendered", async () => {
    vi.useFakeTimers();
    const recorder = recordingCapture();
    render(<CaptureProvider sink={recorder.sink}><DockedPanel {...meta.galleryStates[0].props} /></CaptureProvider>);
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(recorder.events.at(-1)).toEqual({ name: "component_seen", component: "DockedPanel", default_state: "open_docked", seconds_visible: 3 });
  });

  it("closes its Sheet on Escape and emits the close event", async () => {
    const user = userEvent.setup();
    const recorder = recordingCapture();
    const onOpenChange = vi.fn();
    render(<CaptureProvider sink={recorder.sink}><DockedPanel {...meta.galleryStates[1].props} onOpenChange={onOpenChange} /></CaptureProvider>);
    expect(screen.getByRole("dialog", { name: "Workspace" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(recorder.events).toContainEqual({ name: "panel_closed", component: "DockedPanel" });
  });
});
