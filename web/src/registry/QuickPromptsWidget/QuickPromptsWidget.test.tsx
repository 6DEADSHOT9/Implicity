// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";
import { QuickPromptsWidget } from "./QuickPromptsWidget";

describe("QuickPromptsWidget", () => {
  it("validates and renders every declared gallery state with its slot content", () => {
    const entry = registry.getSkeleton("QuickPromptsWidget")!;
    for (const state of entry.meta.galleryStates) {
      expect(propsSchema.safeParse(state.props).success).toBe(true);
      expect(propsSchema.safeParse({ ...state.props, unexpected: true }).success).toBe(false);
      expect(slotsSchema.safeParse(state.slots).success).toBe(true);
      expect(entry.schema.safeParse({ props: state.props, slots: state.slots }).success).toBe(true);
      const recorder = recordingCapture();
      const slotIds = state.slots?.content ?? [];
      const content = slotIds.map((id) => <span key={id}>{id}</span>);
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={{content: content}} /></CaptureProvider>);
      if (slotIds.length) {
        for (const id of slotIds) expect(document.body.textContent).toContain(id);
      } else {
        expect(document.querySelector('[data-slot="empty"]')).toBeTruthy();
      }
      const defaultState = "quick-prompts";
      expect(recorder.events[0]).toEqual({ name: "component_shown", component: "QuickPromptsWidget", default_state: defaultState });
      view.unmount();
    }
  });
  it("renders content without owning a heading", () => {
    const props = meta.galleryStates[0].props as React.ComponentProps<typeof QuickPromptsWidget>;
    const { container } = render(<QuickPromptsWidget {...props} />);
    expect(container.querySelector("h1, h2")).toBeNull();
  });
});
