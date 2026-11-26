// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { Nudge } from "./Nudge";
import { events } from "./events";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";

describe("Nudge", () => {
  it("uses the accessible Alert and Button primitives and leaves actions to the app", async () => {
    const recorder = recordingCapture();
    const onAction = vi.fn();
    const onLater = vi.fn();
    const user = userEvent.setup();
    render(<CaptureProvider sink={recorder.sink}><Nudge title="Continue your project" message="Pick up where you left off." actionLabel="Open project" onAction={onAction} onLater={onLater} /></CaptureProvider>);

    expect(screen.getByRole("status", { name: "Continue your project" })).toBeTruthy();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open project" }));
    await user.keyboard("{Enter}");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Later" }));
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledOnce();
    expect(onLater).toHaveBeenCalledOnce();
    expect(recorder.events).toEqual([{ name: "component_shown", component: "Nudge", default_state: "prompt" }]);
  });

  it("validates and renders its declared gallery state", () => {
    expect(propsSchema.safeParse({ title: "Prompt", message: "Details", actionLabel: "Open" }).success).toBe(true);
    expect(propsSchema.safeParse({ title: "Prompt", message: "Details", actionLabel: "Open", extra: true }).success).toBe(false);
    expect(slotsSchema.safeParse({}).success).toBe(true);
    expect(events).toEqual(["component_shown", "component_seen"]);
    const entry = registry.getSkeleton("Nudge")!;
    for (const state of entry.meta.galleryStates) {
      expect(entry.schema.safeParse({ props: state.props, slots: {} }).success).toBe(true);
      const view = render(<entry.Component props={state.props} slots={{}} />);
      expect(screen.getByRole("status", { name: String(state.props.title) })).toBeTruthy();
      view.unmount();
    }
    expect(entry.schema.safeParse({ props: { ...meta.galleryStates[0].props, extra: true }, slots: {} }).success).toBe(false);
  });

  it("does not submit an enclosing form when Later is activated", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const user = userEvent.setup();
    render(<form onSubmit={onSubmit}><Nudge title="Prompt" message="Details" actionLabel="Open" onLater={vi.fn()} /></form>);

    await user.click(screen.getByRole("button", { name: "Later" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
