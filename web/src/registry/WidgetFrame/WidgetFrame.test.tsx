// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { describe, expect, it } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";
import { WidgetFrame } from "./WidgetFrame";

describe("WidgetFrame", () => {
  it("validates and renders every declared gallery state through the registry", () => {
    const entry = registry.getSkeleton("WidgetFrame")!;
    for (const state of entry.meta.galleryStates) {
      expect(propsSchema.safeParse(state.props).success).toBe(true);
      expect(propsSchema.safeParse({ ...state.props, unknown: true }).success).toBe(false);
      expect(slotsSchema.safeParse(state.slots).success).toBe(true);
      expect(entry.schema.safeParse({ props: state.props, slots: state.slots }).success).toBe(true);
      const recorder = recordingCapture();
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={{content: <span key="example_content">example_content</span>}} /></CaptureProvider>);
      expect(document.body.textContent).toContain("Project overview");
      expect(recorder.events[0]).toEqual({ name: "component_shown", component: "WidgetFrame", default_state: "frame" });
      view.unmount();
    }
  });
  it("leaves dismiss behavior to the supplied callback", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<WidgetFrame title="A widget" lastUpdate="Today" source="Workspace" onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
  it("rejects unknown props and gives each heading a unique id", () => {
    expect(propsSchema.safeParse({ ...meta.galleryStates[0].props, unknown: true }).success).toBe(false);
    render(<><WidgetFrame {...meta.galleryStates[0].props as React.ComponentProps<typeof WidgetFrame>} slots={{content: <span key="content">Content</span>}} /><WidgetFrame {...meta.galleryStates[0].props as React.ComponentProps<typeof WidgetFrame>} slots={{content: <span key="content">Content</span>}} /></>);
    const ids = Array.from(document.querySelectorAll("h1, h2, [role=dialog] [id]")).map(node => node.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
