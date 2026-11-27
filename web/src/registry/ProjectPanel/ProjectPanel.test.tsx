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
      const selectedSlot = (state.slots as Readonly<Record<string, readonly string[]>> | undefined)?.[String(state.props.activeTab)]?.[0];
      const view = render(<ProjectPanel {...state.props} slots={slots} />);
      const selectedLabel = state.props.tabs.find(({ id }) => id === state.props.activeTab)?.label;
      expect(screen.getByRole("tab", { name: selectedLabel }).getAttribute("aria-selected")).toBe("true");
      expect(screen.getByText(selectedSlot!)).toBeTruthy();
      view.unmount();
    }
  });

  it("renders any non-empty subset that includes the active fixed tab id", () => {
    const props = { title: "Project", tabs: [{ id: "files", label: "Work files" }], activeTab: "files" } as const;
    expect(propsSchema.safeParse(props).success).toBe(true);
    render(<ProjectPanel {...props} slots={{ files: [<span key="file">Release plan</span>] }} />);
    expect(screen.getByRole("tab", { name: "Work files" }).getAttribute("aria-selected")).toBe("true");
    expect(document.querySelector('[data-slot="item"]')).toBeTruthy();
    expect(screen.getByText("Release plan")).toBeTruthy();
  });

  it("rejects missing and duplicate active tabs at runtime while JSON Schema checks shape", async () => {
    const state = meta.galleryStates[0];
    const missing = { ...state.props, tabs: [{ id: "files", label: "Files" }], activeTab: "decisions" };
    const duplicate = { ...state.props, tabs: [{ id: "decisions", label: "Decisions" }, { id: "decisions", label: "More decisions" }] };
    const subset = { ...state.props, tabs: [{ id: "files", label: "Files" }], activeTab: "files" };
    expect(propsSchema.safeParse(missing).success).toBe(false);
    expect(propsSchema.safeParse(duplicate).success).toBe(false);
    expect(propsSchema.safeParse(subset).success).toBe(true);
    expect(slotsSchema.safeParse(state.slots).success).toBe(true);
    const schema = (generatedSchema as { properties: { props: object } }).properties.props;
    const validate = new Ajv2020({ strict: false }).compile(schema);
    expect(validate(state.props)).toBe(true);
    expect(validate(subset)).toBe(true);
    expect(validate(missing)).toBe(true);
    expect(validate(duplicate)).toBe(true);
    expect(validate({ ...state.props, tabs: [] })).toBe(false);

    const user = userEvent.setup();
    const recorder = recordingCapture();
    const onTabChange = vi.fn();
    render(<CaptureProvider sink={recorder.sink}><ProjectPanel {...state.props} onTabChange={onTabChange} /></CaptureProvider>);
    screen.getByRole("tab", { name: "Decisions" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(onTabChange).toHaveBeenCalledWith("constraints");
    expect(recorder.events).toEqual([{ name: "component_shown", component: "ProjectPanel", default_state: "decisions" }]);
    expect(events).toEqual(["component_shown", "component_seen"]);
  });
});
