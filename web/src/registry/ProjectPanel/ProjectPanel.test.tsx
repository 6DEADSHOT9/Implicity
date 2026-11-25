// @vitest-environment jsdom
import Ajv2020 from "ajv/dist/2020.js";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import generatedSchema from "../../../../contracts/generated/components/ProjectPanel.schema.json" with { type: "json" };
import { CaptureProvider, recordingCapture } from "../capture";
import { ProjectPanel } from "./ProjectPanel";
import { events } from "./events";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";

describe("ProjectPanel public interface", () => {
  it("renders only the selected tab's slot content", () => {
    for (const state of meta.galleryStates) {
      const slots = Object.fromEntries(Object.entries(state.slots ?? {}).map(([slot, ids]) => [slot, (ids as readonly string[]).map((id) => <span key={id}>{id}</span>)]));
      const selectedSlot = Object.values(state.slots ?? {}).flat()[0];
      const view = render(<ProjectPanel {...state.props} slots={slots} />);
      expect(screen.getByRole("tab", { name: state.id }).getAttribute("aria-selected")).toBe("true");
      expect(screen.getByText(selectedSlot)).toBeTruthy();
      view.unmount();
    }
  });

  it("rejects missing and duplicate active tabs in runtime and JSON Schema", async () => {
    const state = meta.galleryStates[0];
    const missing = { ...state.props, tabs: ["files"] };
    const duplicate = { ...state.props, tabs: ["decisions", "decisions"] };
    expect(propsSchema.safeParse(missing).success).toBe(false);
    expect(propsSchema.safeParse(duplicate).success).toBe(false);
    expect(slotsSchema.safeParse(state.slots).success).toBe(true);
    const schema = (generatedSchema as { properties: { props: object } }).properties.props;
    const validate = new Ajv2020({ strict: false }).compile(schema);
    expect(validate(state.props)).toBe(true);
    expect(validate(missing)).toBe(false);
    expect(validate(duplicate)).toBe(false);

    const user = userEvent.setup();
    const recorder = recordingCapture();
    const onTabChange = vi.fn();
    render(<CaptureProvider sink={recorder.sink}><ProjectPanel {...state.props} onTabChange={onTabChange} /></CaptureProvider>);
    screen.getByRole("tab", { name: "decisions" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(onTabChange).toHaveBeenCalledWith("constraints");
    expect(recorder.events).toEqual([{ name: "component_shown", component: "ProjectPanel", default_state: "decisions" }]);
    expect(events).toEqual(["component_shown", "component_seen"]);
  });
});
