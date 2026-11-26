// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { MessageBody } from "./MessageBody";
import { meta } from "./meta";
import { propsSchema } from "./schema";

describe("MessageBody", () => {
  it("renders gallery content and validates its public props", () => {
    const state = meta.galleryStates[0];
    expect(propsSchema.safeParse(state.props).success).toBe(true);
    render(<MessageBody {...state.props} />);
    expect(screen.getByRole("article", { name: "Message" })).toBeTruthy();
    expect(screen.getByText("useful detail")).toBeTruthy();
    expect(propsSchema.safeParse({ content: "" }).success).toBe(false);
  });

  it("renders and reports every declared registry gallery state", () => {
    for (const entry of registry.entries.values()) for (const state of entry.meta.galleryStates) {
      const recorder = recordingCapture();
      expect(entry.schema.safeParse({ props: state.props, slots: state.slots ?? {} }).success).toBe(true);
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={Object.fromEntries(Object.entries(state.slots ?? {}).map(([slot, children]) => [slot, children]))} /></CaptureProvider>);
      if (entry.id !== "ChangeNotice") expect(recorder.events).toContainEqual({ name: "component_shown", component: entry.id, default_state: state.id });
      view.unmount();
    }
  });
});
