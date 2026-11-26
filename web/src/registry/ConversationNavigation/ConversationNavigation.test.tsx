// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { propsSchema, slotsSchema } from "./schema";

afterEach(cleanup);

describe("ConversationNavigation", () => {
  const entry = registry.getSkeleton("ConversationNavigation")!;
  it("validates and renders every declared gallery state through the registry interface", () => {
    for (const state of entry.meta.galleryStates) {
      const slots = Object.fromEntries(Object.entries(state.slots ?? {}).map(([slot, content]) => [slot, content]));
      expect(entry.schema.safeParse({ props: state.props, slots }).success, state.id).toBe(true);
      const recorder = recordingCapture();
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={slots} /></CaptureProvider>);
      expect(view.getByRole("navigation", { name: "Conversations" })).toBeTruthy();
      if (state.id === "empty") expect(view.getByText("No conversations yet")).toBeTruthy();
      else expect(view.getByRole("button", { name: "Research" })).toBeTruthy();
      expect(recorder.events).toContainEqual({ name: "component_shown", component: "ConversationNavigation", default_state: state.id });
      view.unmount();
    }
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
