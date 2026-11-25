// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { ChangeNotice } from "./ChangeNotice";
import { events } from "./events";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";

const decisionId = "dec_123e4567-e89b-42d3-a456-426614174000";

describe("ChangeNotice", () => {
  it("uses the accessible inline primitive and emits its declared actions", async () => {
    const recorder = recordingCapture();
    const onKeep = vi.fn();
    const onUndo = vi.fn();
    const user = userEvent.setup();
    render(<CaptureProvider sink={recorder.sink}><ChangeNotice decision_id={decisionId} title="Density changed" reason="Long answers were often expanded." presentation="inline" onKeep={onKeep} onUndo={onUndo} /></CaptureProvider>);

    expect(screen.getByRole("status", { name: "Density changed" })).toBeTruthy();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep" }));
    await user.keyboard("{Enter}");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Undo" }));
    await user.keyboard("{Enter}");
    expect(onKeep).toHaveBeenCalledOnce();
    expect(onUndo).toHaveBeenCalledOnce();
    expect(recorder.events).toEqual([
      { name: "component_shown", component: "ChangeNotice", default_state: "inline" },
      { name: "change_kept", decision_id: decisionId },
      { name: "change_undone", decision_id: decisionId },
    ]);
  });

  it("validates and renders each declared registry state, including the toast overlay", async () => {
    expect(propsSchema.safeParse({ decision_id: decisionId, title: "Changed", reason: "Because.", presentation: "inline" }).success).toBe(true);
    expect(propsSchema.safeParse({ decision_id: decisionId, title: "Changed", reason: "Because.", presentation: "unknown" }).success).toBe(false);
    expect(slotsSchema.safeParse({}).success).toBe(true);
    expect(events).toContain("change_kept");
    const entry = registry.getSkeleton("ChangeNotice")!;
    expect(entry.meta.galleryStates.map(({ id }) => id)).toEqual(["inline", "toast"]);
    for (const state of entry.meta.galleryStates) {
      expect(entry.schema.safeParse({ props: state.props, slots: {} }).success).toBe(true);
      const view = render(<entry.Component props={state.props} slots={{}} />);
      expect(await screen.findByRole("status", { name: String(state.props.title) })).toBeTruthy();
      if (state.id === "toast") {
        const user = userEvent.setup();
        await user.tab();
        expect(document.activeElement?.closest("[data-sonner-toast]")).toBeTruthy();
        await user.tab();
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep" }));
        await user.keyboard("{Enter}");
      } else {
        expect(document.querySelector('[data-slot="marker"]')).toBeTruthy();
      }
      view.unmount();
    }
    expect(entry.schema.safeParse({ props: { ...meta.galleryStates[0].props, extra: true }, slots: {} }).success).toBe(false);
  });

  it("isolates multiple toast hosts and refreshes content and callbacks", async () => {
    const oldKeep = vi.fn();
    const newKeep = vi.fn();
    const user = userEvent.setup();
    const view = render(<>
      <ChangeNotice decision_id={decisionId} title="First notice" reason="First reason" presentation="toast" onKeep={oldKeep} />
      <ChangeNotice decision_id="dec_223e4567-e89b-42d3-a456-426614174000" title="Second notice" reason="Second reason" presentation="toast" />
    </>);

    expect(await screen.findByRole("status", { name: "First notice" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Second notice" })).toBeTruthy();
    expect(screen.getAllByRole("status")).toHaveLength(2);
    const ids = [...document.querySelectorAll("[id]")].map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    view.rerender(<>
      <ChangeNotice decision_id={decisionId} title="Updated notice" reason="Updated reason" presentation="toast" onKeep={newKeep} />
      <ChangeNotice decision_id="dec_223e4567-e89b-42d3-a456-426614174000" title="Second notice" reason="Second reason" presentation="toast" />
    </>);
    expect(await screen.findByRole("status", { name: "Updated notice" })).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Keep" })[0]);
    expect(oldKeep).not.toHaveBeenCalled();
    expect(newKeep).toHaveBeenCalledOnce();
  });

  it("does not submit an enclosing form when an action is activated", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const user = userEvent.setup();
    const view = render(<form onSubmit={onSubmit}><ChangeNotice decision_id={decisionId} title="Density changed" reason="Because." presentation="inline" onKeep={vi.fn()} /></form>);
    await user.click(screen.getByRole("button", { name: "Keep" }));
    view.unmount();
    render(<form onSubmit={onSubmit}><ChangeNotice decision_id={decisionId} title="Density changed" reason="Because." presentation="toast" onKeep={vi.fn()} /></form>);
    await user.click(await screen.findByRole("button", { name: "Keep" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
