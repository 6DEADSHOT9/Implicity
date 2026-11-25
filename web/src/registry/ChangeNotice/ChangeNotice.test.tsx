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
      }
      view.unmount();
    }
    expect(entry.schema.safeParse({ props: { ...meta.galleryStates[0].props, extra: true }, slots: {} }).success).toBe(false);
  });
});
