// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";
import { NowPlayingWidget } from "./NowPlayingWidget";

describe("NowPlayingWidget", () => {
  it("validates and renders every declared gallery state with its slot content", () => {
    const entry = registry.getSkeleton("NowPlayingWidget")!;
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
      const defaultState = "now-playing";
      expect(recorder.events[0]).toEqual({ name: "component_shown", component: "NowPlayingWidget", default_state: defaultState });
      view.unmount();
    }
  });
  it("renders the documented progress value", () => {
    const { rerender } = render(<NowPlayingWidget progress={35} slots={{ content: ["media_details"] }} />);
    expect(screen.getByRole("progressbar", { name: "Playback progress" }).getAttribute("value")).toBe("35");
    rerender(<NowPlayingWidget progress={35} />);
    expect(screen.queryByRole("progressbar", { name: "Playback progress" })).toBeNull();
  });
  it("renders content without owning a heading", () => {
    const props = meta.galleryStates[0].props as React.ComponentProps<typeof NowPlayingWidget>;
    const { container } = render(<NowPlayingWidget {...props} />);
    expect(container.querySelector("h1, h2")).toBeNull();
  });
});
