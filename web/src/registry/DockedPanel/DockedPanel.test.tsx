// @vitest-environment jsdom
import Ajv2020 from "ajv/dist/2020.js";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import generatedSchema from "../../../../contracts/generated/components/DockedPanel.schema.json" with { type: "json" };
import { CaptureProvider, recordingCapture } from "../capture";
import { DockedPanel } from "./DockedPanel";
import { events } from "./events";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";

const mobile = vi.hoisted(() => ({ value: true }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile.value }));

afterEach(() => { mobile.value = true; });

describe("DockedPanel public interface", () => {
  it("renders an accessible Sheet and tabs on small screens", () => {
    render(<DockedPanel {...meta.galleryStates[0].props} slots={{ main: [<p key="content">panel content</p>] }} />);
    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Workspace" })).toBeTruthy();
  });

  it("validates metadata states, events, and tab relationships in runtime and JSON Schema", () => {
    const recorder = recordingCapture();
    for (const state of meta.galleryStates) {
      expect(propsSchema.safeParse(state.props).success).toBe(true);
      const view = render(<CaptureProvider sink={recorder.sink}><DockedPanel {...state.props} /></CaptureProvider>);
      expect(meta.defaultStates.map(String)).toContain(state.id);
      expect(recorder.events.at(-1)).toMatchObject({ name: "component_shown", default_state: state.id });
      view.unmount();
    }
    expect(propsSchema.safeParse({ ...meta.galleryStates[0].props, activeTab: "Missing" }).success).toBe(false);
    expect(propsSchema.safeParse({ ...meta.galleryStates[0].props, tabs: ["Details", "Details"] }).success).toBe(false);
    expect(slotsSchema.safeParse({ main: ["panel_content"] }).success).toBe(true);
    expect(events).toEqual(["component_shown", "component_seen", "panel_opened", "panel_closed", "panel_docked", "panel_undocked"]);
    const schema = (generatedSchema as { properties: { props: object } }).properties.props;
    const validate = new Ajv2020({ strict: false }).compile(schema);
    expect(validate(meta.galleryStates[0].props)).toBe(true);
    expect(validate({ ...meta.galleryStates[0].props, activeTab: "Missing" })).toBe(false);
    expect(validate({ ...meta.galleryStates[0].props, tabs: ["Details", "Details"] })).toBe(false);
  });

  it("calls controlled callbacks without recording a transition until props change", async () => {
    const user = userEvent.setup();
    const recorder = recordingCapture();
    const onOpenChange = vi.fn();
    const onDockChange = vi.fn();
    const view = render(<CaptureProvider sink={recorder.sink}><DockedPanel {...meta.galleryStates[0].props} onOpenChange={onOpenChange} onDockChange={onDockChange} /></CaptureProvider>);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(recorder.events).toEqual([{ name: "component_shown", component: "DockedPanel", default_state: "open_docked" }]);
    view.rerender(<CaptureProvider sink={recorder.sink}><DockedPanel {...meta.galleryStates[0].props} open={false} onOpenChange={onOpenChange} onDockChange={onDockChange} /></CaptureProvider>);
    expect(recorder.events.at(-1)).toEqual({ name: "panel_closed", component: "DockedPanel" });
    view.rerender(<CaptureProvider sink={recorder.sink}><DockedPanel {...meta.galleryStates[0].props} onOpenChange={onOpenChange} onDockChange={onDockChange} /></CaptureProvider>);
    await user.click(screen.getByRole("button", { name: "Undock" }));
    expect(onDockChange).toHaveBeenCalledWith(false);
    expect(recorder.events.at(-1)).toEqual({ name: "panel_opened", component: "DockedPanel" });
    view.rerender(<CaptureProvider sink={recorder.sink}><DockedPanel {...meta.galleryStates[1].props} onOpenChange={onOpenChange} onDockChange={onDockChange} /></CaptureProvider>);
    expect(recorder.events.at(-1)).toEqual({ name: "panel_undocked", component: "DockedPanel" });
  });

  it("uses unique layout and panel ids when composed twice", () => {
    mobile.value = false;
    render(<><DockedPanel {...meta.galleryStates[0].props} /><DockedPanel {...meta.galleryStates[0].props} /></>);
    const groups = [...document.querySelectorAll('[data-slot="resizable-panel-group"]')];
    expect(groups).toHaveLength(2);
    const ids = groups.flatMap((group) => [group.id, ...[...group.querySelectorAll("[id]")].map((element) => element.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(screen.getAllByRole("separator", { name: "Resize workspace and panel" })).toHaveLength(2);
  });
});
