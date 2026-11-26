// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { Search as SearchComponent } from "./Search";
import { propsSchema, slotsSchema } from "./schema";

afterEach(cleanup);

describe("Search", () => {
  const entry = registry.getSkeleton("Search")!;
  it("validates and renders every declared gallery state through the registry interface", () => {
    for (const state of entry.meta.galleryStates) {
      const slots = state.slots ?? {};
      expect(entry.schema.safeParse({ props: state.props, slots }).success, state.id).toBe(true);
      const recorder = recordingCapture();
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={slots} /></CaptureProvider>);
      if (state.id === "open") expect(view.getByRole("dialog", { name: "Search" })).toBeTruthy();
      else expect(view.getByRole("button", { name: "Search" })).toBeTruthy();
      expect(recorder.events).toContainEqual({ name: "component_shown", component: "Search", default_state: state.id });
      view.unmount();
    }
  });
  it("records one search per opening, including after clearing a query", async () => {
    const recorder = recordingCapture();
    const onSearch = vi.fn();
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const results = [{ id: "chat-1", label: "Planning session" }];
    const view = render(<CaptureProvider sink={recorder.sink}><SearchComponent open={true} results={results} onSearch={onSearch} onSelect={onSelect} onOpenChange={onOpenChange} /></CaptureProvider>);
    const input = screen.getByRole("combobox", { name: "Search conversations" });
    await user.type(input, "private query");
    await user.clear(input);
    await user.type(input, "another query");
    expect(onSearch).toHaveBeenLastCalledWith("another query");
    expect(recorder.events.filter(({ name }) => name === "search_used")).toEqual([{ name: "search_used" }]);
    view.rerender(<CaptureProvider sink={recorder.sink}><SearchComponent open={false} results={results} onSearch={onSearch} onSelect={onSelect} onOpenChange={onOpenChange} /></CaptureProvider>);
    view.rerender(<CaptureProvider sink={recorder.sink}><SearchComponent open={true} results={results} onSearch={onSearch} onSelect={onSelect} onOpenChange={onOpenChange} /></CaptureProvider>);
    await user.type(screen.getByRole("combobox", { name: "Search conversations" }), "third query");
    expect(recorder.events.filter(({ name }) => name === "search_used")).toEqual([{ name: "search_used" }, { name: "search_used" }]);
    await user.click(screen.getByRole("option", { name: "Planning session" }));
    expect(onSelect).toHaveBeenCalledWith("chat-1");
    expect(JSON.stringify(recorder.events)).not.toContain("private query");
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
