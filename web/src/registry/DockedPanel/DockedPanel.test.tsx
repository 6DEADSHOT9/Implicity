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

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile.value }));

afterEach(() => { mobile.value = false; });

describe("DockedPanel public interface", () => {
  it("renders an accessible Sheet and tabs on small screens", () => {
    mobile.value = true;
    render(<DockedPanel {...meta.galleryStates[0].props} slots={{ main: [<p key="content">panel content</p>] }} />);
    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Workspace" })).toBeTruthy();
  });

  it("renders custom tab labels and content from slots named by tab id", () => {
    const custom = { ...meta.galleryStates[0].props, tabs: [{ id: "notes", label: "Notes" }, { id: "runs", label: "Runs" }], activeTab: "notes" };
    expect(propsSchema.safeParse(custom).success).toBe(true);
    expect(slotsSchema.safeParse({ notes: ["note_child"], runs: [] }).success).toBe(true);
    render(<DockedPanel {...custom} slots={{ notes: [<p key="note">The deployment notes</p>], runs: [] }} />);
    expect(screen.getByRole("tab", { name: "Notes" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("The deployment notes")).toBeTruthy();
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
    const props = meta.galleryStates[0].props;
    const customTabs = { ...props, tabs: [{ id: "notes", label: "Notes" }], activeTab: "notes" };
    const missingActive = { ...props, activeTab: "missing" };
    const duplicateIds = { ...props, tabs: [{ id: "details", label: "Details" }, { id: "details", label: "More details" }] };
    expect(propsSchema.safeParse(customTabs).success).toBe(true);
    expect(propsSchema.safeParse(missingActive).success).toBe(false);
    expect(propsSchema.safeParse(duplicateIds).success).toBe(false);
    expect(slotsSchema.safeParse({ details: ["panel_content"] }).success).toBe(true);
    expect(events).toEqual(["component_shown", "component_seen", "panel_opened", "panel_closed", "panel_docked", "panel_undocked"]);
    const schema = (generatedSchema as { properties: { props: object } }).properties.props;
    const validate = new Ajv2020({ strict: false }).compile(schema);
    expect(validate(meta.galleryStates[0].props)).toBe(true);
    expect(validate(customTabs)).toBe(true);
    expect(validate(missingActive)).toBe(true);
    expect(validate(duplicateIds)).toBe(true);
    expect(validate({ ...props, tabs: [] })).toBe(false);
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

  it("keeps Sheet dismissal controlled and reports a tab choice by id", async () => {
    mobile.value = true;
    const user = userEvent.setup();
    const recorder = recordingCapture();
    const onOpenChange = vi.fn();
    const onTabChange = vi.fn();
    const props = meta.galleryStates[0].props;
    const historyLabel = props.tabs[1].label;
    const slots = { details: [], history: [<p key="history">History entry</p>] };
    const view = render(<CaptureProvider sink={recorder.sink}><DockedPanel {...props} onOpenChange={onOpenChange} onTabChange={onTabChange} slots={slots} /></CaptureProvider>);
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(recorder.events.some(({ name }) => name === "panel_closed")).toBe(false);
    await user.click(screen.getByRole("tab", { name: historyLabel }));
    expect(onTabChange).toHaveBeenCalledWith("history");
    view.rerender(<CaptureProvider sink={recorder.sink}><DockedPanel {...props} activeTab="history" onOpenChange={onOpenChange} onTabChange={onTabChange} slots={slots} /></CaptureProvider>);
    expect(screen.getByRole("tab", { name: historyLabel }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("History entry")).toBeTruthy();
  });

  it("reports the small-screen Sheet without changing the saved dock preference", async () => {
    mobile.value = true;
    const capture = recordingCapture();
    const onDockChange = vi.fn();
    const view = render(<CaptureProvider sink={capture.sink}><DockedPanel {...meta.galleryStates[0].props} onDockChange={onDockChange} /></CaptureProvider>);
    expect(capture.events[0]).toEqual({ name: "component_shown", component: "DockedPanel", default_state: "open_undocked" });
    expect(screen.queryByRole("button", { name: "Undock" })).toBeNull();

    mobile.value = false;
    view.rerender(<CaptureProvider sink={capture.sink}><DockedPanel {...meta.galleryStates[0].props} onDockChange={onDockChange} /></CaptureProvider>);
    expect(capture.events).toEqual([{ name: "component_shown", component: "DockedPanel", default_state: "open_undocked" }]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Undock" }));
    expect(onDockChange).toHaveBeenCalledWith(false);
    expect(capture.events).toHaveLength(1);
    view.rerender(<CaptureProvider sink={capture.sink}><DockedPanel {...meta.galleryStates[0].props} docked={false} onDockChange={onDockChange} /></CaptureProvider>);
    expect(capture.events.at(-1)).toEqual({ name: "panel_undocked", component: "DockedPanel" });

    mobile.value = true;
    view.rerender(<CaptureProvider sink={capture.sink}><DockedPanel {...meta.galleryStates[0].props} docked={false} onDockChange={onDockChange} /></CaptureProvider>);
    expect(capture.events.at(-1)).toEqual({ name: "panel_undocked", component: "DockedPanel" });
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
