// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { Nudge } from "./Nudge";
import { events } from "./events";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("Nudge", () => {
  it("shows an accessible prompt and calls app callbacks without inventing events", async () => {
    const recorder = recordingCapture();
    const onAction = vi.fn();
    const onLater = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    vi.useFakeTimers();
    await act(async () => root.render(createElement(CaptureProvider, { sink: recorder.sink, children: createElement(Nudge, {
      title: "Continue your project",
      message: "Pick up where you left off.",
      actionLabel: "Open project",
      onAction,
      onLater,
    }) })));
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toBe("Open project");
    await act(async () => { buttons[0].click(); buttons[1].click(); });
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(onAction).toHaveBeenCalledOnce();
    expect(onLater).toHaveBeenCalledOnce();
    expect(recorder.events).toEqual([
      { name: "component_shown", component: "Nudge", default_state: "prompt" },
      { name: "component_seen", component: "Nudge", default_state: "prompt", seconds_visible: 3 },
    ]);
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("validates props and gallery states", () => {
    expect(propsSchema.safeParse({ title: "Prompt", message: "Details", actionLabel: "Open" }).success).toBe(true);
    expect(propsSchema.safeParse({ title: "Prompt", message: "Details", actionLabel: "Open", extra: true }).success).toBe(false);
    expect(slotsSchema.safeParse({}).success).toBe(true);
    expect(events).toEqual(["component_shown", "component_seen"]);
    expect(meta.galleryStates.every(({ props }) => propsSchema.safeParse(props).success)).toBe(true);
    const entry = registry.getSkeleton("Nudge")!;
    for (const state of entry.meta.galleryStates) {
      expect(entry.schema.safeParse({ props: state.props, slots: {} }).success).toBe(true);
      expect(renderToStaticMarkup(createElement(entry.Component, { props: state.props, slots: {} }))).toContain(state.props.title);
    }
    expect(entry.schema.safeParse({ props: { ...meta.galleryStates[0].props, extra: true }, slots: {} }).success).toBe(false);
  });
});
