// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture } from "../capture";
import { RunActivity } from "./RunActivity";
import { meta } from "./meta";
import { propsSchema } from "./schema";

describe("RunActivity", () => {
  it("renders gallery states and validates step status", () => {
    for (const state of meta.galleryStates) { expect(propsSchema.safeParse(state.props).success).toBe(true); const view = render(<RunActivity {...state.props} />); expect(screen.getByRole("button")).toBeTruthy(); view.unmount(); }
    expect(propsSchema.safeParse({ title: "Run", steps: [{ label: "Step", status: "unknown" }], open: true }).success).toBe(false);
  });

  it("records section changes only after the controlled open state changes", async () => {
    const state = meta.galleryStates[0]; const recorder = recordingCapture(); const onOpenChange = vi.fn(); const user = userEvent.setup();
    const view = render(<CaptureProvider sink={recorder.sink}><RunActivity {...state.props} onOpenChange={onOpenChange} /></CaptureProvider>);
    await user.click(screen.getByRole("button"));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(recorder.events).toEqual([{ name: "component_shown", component: "RunActivity", default_state: "folded", slot: "steps" }]);
    view.rerender(<CaptureProvider sink={recorder.sink}><RunActivity title="Run activity" steps={state.props.steps} open /></CaptureProvider>);
    expect(recorder.events).toEqual([
      { name: "component_shown", component: "RunActivity", default_state: "folded", slot: "steps" },
      { name: "section_expanded", component: "RunActivity", slot: "steps" },
    ]);
    view.rerender(<CaptureProvider sink={recorder.sink}><RunActivity title="Run activity" steps={state.props.steps} open={false} /></CaptureProvider>);
    expect(recorder.events).toEqual([
      { name: "component_shown", component: "RunActivity", default_state: "folded", slot: "steps" },
      { name: "section_expanded", component: "RunActivity", slot: "steps" },
      { name: "section_collapsed", component: "RunActivity", slot: "steps" },
    ]);
  });
});
