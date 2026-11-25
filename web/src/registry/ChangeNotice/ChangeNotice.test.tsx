// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { ChangeNotice } from "./ChangeNotice";
import { events } from "./events";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("ChangeNotice", () => {
  it("renders each gallery state through its validated registry entry and emits actions", async () => {
    const recorder = recordingCapture();
    const onKeep = vi.fn();
    const onUndo = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    vi.useFakeTimers();
    await act(async () => root.render(createElement(CaptureProvider, { sink: recorder.sink, children: createElement(ChangeNotice, {
      decision_id: "dec_123e4567-e89b-42d3-a456-426614174000",
      title: "Density changed",
      reason: "Long answers were often expanded.",
      onKeep,
      onUndo,
    }) })));
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(2);
    for (const button of container.querySelectorAll("button")) expect(button.textContent).toBeTruthy();
    await act(async () => { container.querySelectorAll("button")[0].click(); container.querySelectorAll("button")[1].click(); });
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(onKeep).toHaveBeenCalledOnce();
    expect(onUndo).toHaveBeenCalledOnce();
    expect(recorder.events).toEqual([
      { name: "component_shown", component: "ChangeNotice", default_state: "active" },
      { name: "change_kept", decision_id: "dec_123e4567-e89b-42d3-a456-426614174000" },
      { name: "change_undone", decision_id: "dec_123e4567-e89b-42d3-a456-426614174000" },
      { name: "component_seen", component: "ChangeNotice", default_state: "active", seconds_visible: 3 },
    ]);
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("declares valid schemas, events and gallery examples", () => {
    expect(propsSchema.safeParse({ decision_id: "dec_123e4567-e89b-42d3-a456-426614174000", title: "Changed", reason: "Because." }).success).toBe(true);
    expect(propsSchema.safeParse({ decision_id: "dec_123e4567-e89b-42d3-a456-426614174000", title: "Changed", reason: "Because.", extra: true }).success).toBe(false);
    expect(slotsSchema.safeParse({}).success).toBe(true);
    expect(events).toContain("change_kept");
    expect(meta.galleryStates.every(({ props }) => propsSchema.safeParse(props).success)).toBe(true);
    const entry = registry.getSkeleton("ChangeNotice")!;
    for (const state of entry.meta.galleryStates) {
      expect(entry.schema.safeParse({ props: state.props, slots: {} }).success).toBe(true);
      expect(renderToStaticMarkup(createElement(entry.Component, { props: state.props, slots: {} }))).toContain(state.props.title);
    }
    expect(entry.schema.safeParse({ props: { ...meta.galleryStates[0].props, extra: true }, slots: {} }).success).toBe(false);
  });
});
