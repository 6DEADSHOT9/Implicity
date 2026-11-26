// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture } from "../capture";
import { Details } from "./Details";
import { meta } from "./meta";
import { propsSchema } from "./schema";

describe("Details", () => {
  it("renders both states, validates props, and emits displayed changes", async () => {
    const state = meta.galleryStates[0]; expect(propsSchema.safeParse(state.props).success).toBe(true);
    const recorder = recordingCapture(); const onOpenChange = vi.fn(); const user = userEvent.setup();
    const view = render(<CaptureProvider sink={recorder.sink}><Details {...state.props} onOpenChange={onOpenChange} /></CaptureProvider>);
    expect(screen.getByRole("button", { name: "Why this works" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Why this works" })); expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(recorder.events).toEqual([{ name: "component_shown", component: "Details", default_state: "folded", slot: "details" }]);
    view.rerender(<CaptureProvider sink={recorder.sink}><Details title="Why this works" content="The result follows from the evidence." open /></CaptureProvider>);
    expect(recorder.events).toEqual([
      { name: "component_shown", component: "Details", default_state: "folded", slot: "details" },
      { name: "section_expanded", component: "Details", slot: "details" },
    ]);
    view.rerender(<CaptureProvider sink={recorder.sink}><Details title="Why this works" content="The result follows from the evidence." open /></CaptureProvider>);
    expect(recorder.events).toHaveLength(2);
    expect(propsSchema.safeParse({ title: "", content: "x", open: false }).success).toBe(false);
  });
});
