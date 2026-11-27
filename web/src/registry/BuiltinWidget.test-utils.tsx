// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "./index";
export function testBuiltinWidget(id: string) {
  describe(id, () => {
    it("validates and renders gallery states with content-only output", () => {
      const entry = registry.getSkeleton(id)!;
      expect(entry.meta.widget).toBeTruthy();
      for (const state of entry.meta.galleryStates) {
        expect(entry.propsSchema.safeParse(state.props).success).toBe(true);
        expect(entry.propsSchema.safeParse({ ...state.props, unexpected: true }).success).toBe(false);
        expect(entry.slotsSchema.safeParse(state.slots).success).toBe(true);
        expect(entry.schema.safeParse({ props: state.props, slots: state.slots }).success).toBe(true);
        const recorder = recordingCapture();
        const slotIds = (state.slots?.content ?? []) as string[];
        const content = slotIds;
        const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={{ content }} /></CaptureProvider>);
        if (slotIds.length) {
          for (const slot of slotIds) expect(document.body.textContent).toContain(slot);
        } else {
          expect(document.querySelector('[data-slot="empty"]')).toBeTruthy();
        }
        expect(recorder.events[0]).toEqual({ name: "component_shown", component: id, default_state: entry.meta.defaultStates[0] });
        expect(view.container.querySelector("h1, h2")).toBeNull();
        view.unmount();
      }
    });
  });
}
