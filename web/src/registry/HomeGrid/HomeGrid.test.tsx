// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";
import { HomeGrid } from "./HomeGrid";

describe("HomeGrid", () => {
  it("validates and renders every declared gallery state through the registry", () => {
    const entry = registry.getSkeleton("HomeGrid")!;
    for (const state of entry.meta.galleryStates) {
      expect(propsSchema.safeParse(state.props).success).toBe(true);
      expect(propsSchema.safeParse({ ...state.props, unknown: true }).success).toBe(false);
      expect(slotsSchema.safeParse(state.slots).success).toBe(true);
      expect(entry.schema.safeParse({ props: state.props, slots: state.slots }).success).toBe(true);
      const recorder = recordingCapture();
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={{widgets: <span key="example_content">example_content</span>}} /></CaptureProvider>);
      expect(document.body.textContent).toContain("Your Home");
      expect(recorder.events[0]).toEqual({ name: "component_shown", component: "HomeGrid", default_state: "grid" });
      view.unmount();
    }
  });
  it("rejects unknown props and gives each heading a unique id", () => {
    expect(propsSchema.safeParse({ ...meta.galleryStates[0].props, unknown: true }).success).toBe(false);
    render(<><HomeGrid {...meta.galleryStates[0].props as React.ComponentProps<typeof HomeGrid>} slots={{widgets: <span key="content">Content</span>}} /><HomeGrid {...meta.galleryStates[0].props as React.ComponentProps<typeof HomeGrid>} slots={{widgets: <span key="content">Content</span>}} /></>);
    const ids = Array.from(document.querySelectorAll("h1, h2, [role=dialog] [id]")).map(node => node.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
