// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture } from "../capture";
import { ProjectPanel } from "./ProjectPanel";
import { events } from "./events";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";

afterEach(() => vi.useRealTimers());

describe("ProjectPanel public interface", () => {
  it("renders each gallery tab and its slot content", () => {
    for (const state of meta.galleryStates) {
      const slots = Object.fromEntries(Object.entries(state.slots ?? {}).map(([slot, ids]) => [slot, (ids as readonly string[]).map((id) => <span key={id}>{id}</span>)]));
      const view = render(<ProjectPanel {...state.props} slots={slots} />);
      expect(screen.getByRole("tab", { name: state.id })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Project" })).toBeTruthy();
      view.unmount();
    }
  });

  it("validates props and slots and keeps tabs keyboard-accessible", async () => {
    expect(propsSchema.safeParse(meta.galleryStates[0].props).success).toBe(true);
    expect(propsSchema.safeParse({ ...meta.galleryStates[0].props, activeTab: "other" }).success).toBe(false);
    expect(slotsSchema.safeParse(meta.galleryStates[0].slots).success).toBe(true);
    expect(slotsSchema.safeParse({ ...meta.galleryStates[0].slots, files: ["BadId"] }).success).toBe(false);
    expect(events).toEqual(["component_shown", "component_seen"]);

    const user = userEvent.setup();
    const recorder = recordingCapture();
    const onTabChange = vi.fn();
    render(<CaptureProvider sink={recorder.sink}><ProjectPanel {...meta.galleryStates[0].props} onTabChange={onTabChange} /></CaptureProvider>);
    expect(recorder.events[0]).toEqual({ name: "component_shown", component: "ProjectPanel", default_state: "decisions" });
    screen.getByRole("tab", { name: "decisions" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(onTabChange).toHaveBeenCalledWith("constraints");
  });

  it("emits seen after the panel remains rendered", async () => {
    vi.useFakeTimers();
    const recorder = recordingCapture();
    render(<CaptureProvider sink={recorder.sink}><ProjectPanel {...meta.galleryStates[0].props} /></CaptureProvider>);
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(recorder.events.at(-1)).toEqual({ name: "component_seen", component: "ProjectPanel", default_state: "decisions", seconds_visible: 3 });
  });
});
