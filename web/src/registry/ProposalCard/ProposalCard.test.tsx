// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { ProposalCard } from "./ProposalCard";
import { events } from "./events";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("ProposalCard", () => {
  it("renders the preview, supports keyboard focus and emits declared decision events", async () => {
    const recorder = recordingCapture();
    const onKeep = vi.fn();
    const onDismiss = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    vi.useFakeTimers();
    await act(async () => root.render(createElement(CaptureProvider, { sink: recorder.sink, children: createElement(ProposalCard, {
      proposal_id: "prop_123e4567-e89b-42d3-a456-426614174000",
      proposal_type: "look",
      title: "Notebook look",
      description: "A softer reading layout.",
      preview: "Preview content",
      onKeep,
      onDismiss,
    }) })));
    expect(container.querySelector('[role="region"]')).not.toBeNull();
    expect(container.textContent).toContain("Preview content");
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    buttons[0].focus();
    expect(document.activeElement).toBe(buttons[0]);
    await act(async () => { buttons[0].click(); buttons[1].click(); });
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(onKeep).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(recorder.events).toEqual([
      { name: "component_shown", component: "ProposalCard", default_state: "preview" },
      { name: "proposal_shown", proposal_id: "prop_123e4567-e89b-42d3-a456-426614174000", proposal_type: "look" },
      { name: "proposal_kept", proposal_id: "prop_123e4567-e89b-42d3-a456-426614174000", proposal_type: "look" },
      { name: "proposal_dismissed", proposal_id: "prop_123e4567-e89b-42d3-a456-426614174000", proposal_type: "look" },
      { name: "component_seen", component: "ProposalCard", default_state: "preview", seconds_visible: 3 },
    ]);
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("validates props and gallery states", () => {
    expect(propsSchema.safeParse({ proposal_id: "prop_123e4567-e89b-42d3-a456-426614174000", proposal_type: "dimension", title: "Change", description: "Details" }).success).toBe(true);
    expect(propsSchema.safeParse({ proposal_id: "prop_123e4567-e89b-42d3-a456-426614174000", proposal_type: "other", title: "Change", description: "Details" }).success).toBe(false);
    expect(slotsSchema.safeParse({}).success).toBe(true);
    expect(events).toContain("proposal_dismissed");
    expect(meta.galleryStates.every(({ props }) => propsSchema.safeParse(props).success)).toBe(true);
    const entry = registry.getSkeleton("ProposalCard")!;
    for (const state of entry.meta.galleryStates) {
      expect(entry.schema.safeParse({ props: state.props, slots: {} }).success).toBe(true);
      expect(renderToStaticMarkup(createElement(entry.Component, { props: state.props, slots: {} }))).toContain(state.props.title);
    }
    expect(entry.schema.safeParse({ props: { ...meta.galleryStates[0].props, proposal_type: "unknown" }, slots: {} }).success).toBe(false);
  });
});
