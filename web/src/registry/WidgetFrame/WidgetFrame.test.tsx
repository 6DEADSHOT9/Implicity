// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";
import { WidgetFrame } from "./WidgetFrame";

describe("WidgetFrame", () => {
  it("validates and renders every declared gallery state with its slot content", () => {
    const entry = registry.getSkeleton("WidgetFrame")!;
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
      const defaultState = "frame";
      expect(recorder.events[0]).toEqual({ name: "component_shown", component: "WidgetFrame", default_state: defaultState });
      view.unmount();
    }
  });
  it("dismisses from the widget menu through the owner callback", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<WidgetFrame title="A widget" lastUpdate="Today" source="Workspace" onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: "Widget options for A widget" }));
    await user.click(screen.getByRole("menuitem", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
  it("requires two unique heading ids", () => {
    const props = meta.galleryStates[0].props as React.ComponentProps<typeof WidgetFrame>;
    render(<><WidgetFrame {...props} /><WidgetFrame {...props} /></>);
    const ids = Array.from(document.querySelectorAll("h1, h2")).map((heading) => heading.id);
    expect(ids).toHaveLength(2);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });
});
