// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";
import { HomeGrid } from "./HomeGrid";

describe("HomeGrid", () => {
  it("validates and renders every declared gallery state with its slot content", () => {
    const entry = registry.getSkeleton("HomeGrid")!;
    for (const state of entry.meta.galleryStates) {
      expect(propsSchema.safeParse(state.props).success).toBe(true);
      expect(propsSchema.safeParse({ ...state.props, unexpected: true }).success).toBe(false);
      expect(slotsSchema.safeParse(state.slots).success).toBe(true);
      expect(entry.schema.safeParse({ props: state.props, slots: state.slots }).success).toBe(true);
      const recorder = recordingCapture();
      const slotIds = state.slots?.widgets ?? [];
      const content = slotIds.map((id) => <span key={id}>{id}</span>);
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={{widgets: content}} /></CaptureProvider>);
      if (slotIds.length) {
        for (const id of slotIds) expect(document.body.textContent).toContain(id);
      } else {
        expect(document.querySelector('[data-slot="empty"]')).toBeTruthy();
      }
      const defaultState = "grid";
      expect(recorder.events[0]).toEqual({ name: "component_shown", component: "HomeGrid", default_state: defaultState });
      view.unmount();
    }
  });
  it("requires two unique heading ids", () => {
    const props = meta.galleryStates[0].props as React.ComponentProps<typeof HomeGrid>;
    render(<><HomeGrid {...props} /><HomeGrid {...props} /></>);
    const ids = Array.from(document.querySelectorAll("h1, h2")).map((heading) => heading.id);
    expect(ids).toHaveLength(2);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });
});
