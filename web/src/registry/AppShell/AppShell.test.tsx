// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { AppShell } from "./AppShell";
import { propsSchema, slotsSchema } from "./schema";

afterEach(cleanup);

describe("AppShell", () => {
  const entry = registry.getSkeleton("AppShell")!;
  it("validates and renders every declared gallery state through the registry interface", () => {
    for (const state of entry.meta.galleryStates) {
      const slots = state.slots ?? {};
      expect(entry.schema.safeParse({ props: state.props, slots }).success, state.id).toBe(true);
      const recorder = recordingCapture();
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={slots} /></CaptureProvider>);
      expect(view.getByRole("main")).toBeTruthy();
      expect(view.queryByRole("navigation", { name: "Workspace navigation" })).toBeNull();
      expect(recorder.events).toContainEqual({ name: "component_shown", component: "AppShell", default_state: state.id });
      view.unmount();
    }
  });
  it("preserves main content and emits no panel actions", () => {
    const recorder = recordingCapture();
    const view = render(<CaptureProvider sink={recorder.sink}><AppShell panelOpen={false} slots={{ main: [<textarea aria-label="Draft" key="draft" />] }} /></CaptureProvider>);
    const draft = view.getByRole("textbox", { name: "Draft" });
    act(() => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(draft, "unsent words"); draft.dispatchEvent(new Event("input", { bubbles: true })); });
    const original = view.getByRole("textbox", { name: "Draft" });
    act(() => view.rerender(<CaptureProvider sink={recorder.sink}><AppShell panelOpen={true} slots={{ main: [<textarea aria-label="Draft" key="draft" />], panel: [<p key="panel">Panel content</p>] }} /></CaptureProvider>));
    expect(view.getByRole("textbox", { name: "Draft" })).toBe(original);
    expect((view.getByRole("textbox", { name: "Draft" }) as HTMLTextAreaElement).value).toBe("unsent words");
    expect(view.getByText("Panel content")).toBeTruthy();
    expect(view.queryByRole("button", { name: /panel/i })).toBeNull();
    expect(recorder.events).toEqual([{ name: "component_shown", component: "AppShell", default_state: "default" }]);
  });
  it("does not intercept the sidebar shortcut or write its state cookie", () => {
    render(<CaptureProvider sink={recordingCapture().sink}><AppShell panelOpen={false} /></CaptureProvider>);
    const before = document.cookie;
    const event = new KeyboardEvent("keydown", { key: "b", metaKey: true, cancelable: true });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
    expect(document.cookie).toBe(before);
  });
  it("exports strict props and slots schemas", () => {
    expect(propsSchema.safeParse(entry.meta.galleryStates[0].props).success).toBe(true);
    expect(propsSchema.safeParse({ ...entry.meta.galleryStates[0].props, unexpected: true }).success).toBe(false);
    expect(slotsSchema.safeParse({}).success).toBe(true);
    expect(slotsSchema.safeParse({ unexpected: [] }).success).toBe(false);
    expect(entry.events).toContain("component_shown");
    expect(entry.events).toContain("component_seen");
  });
});
