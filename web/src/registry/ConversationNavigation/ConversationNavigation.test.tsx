// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { propsSchema, slotsSchema } from "./schema";
import { ConversationNavigation } from "./ConversationNavigation";

afterEach(cleanup);

describe("ConversationNavigation", () => {
  const entry = registry.getSkeleton("ConversationNavigation")!;
  it("validates and renders every declared gallery state through the registry interface", () => {
    for (const state of entry.meta.galleryStates) {
      const slots = state.slots ?? {};
      expect(entry.schema.safeParse({ props: state.props, slots }).success, state.id).toBe(true);
      const recorder = recordingCapture();
      const view = render(<CaptureProvider sink={recorder.sink}><entry.Component props={state.props} slots={slots} /></CaptureProvider>);
      expect(view.getByRole("navigation", { name: "Conversations" })).toBeTruthy();
      if (state.id === "empty") expect(view.getByText("No conversations yet")).toBeTruthy();
      else expect(view.getByRole("button", { name: /Research/ })).toBeTruthy();
      expect(recorder.events).toContainEqual({ name: "component_shown", component: "ConversationNavigation", default_state: state.id });
      view.unmount();
    }
  });
  it("passes stable ids for chat, project, recent work, and navigation actions", async () => {
    const user = userEvent.setup();
    const onHome = vi.fn();
    const onNewChat = vi.fn();
    const onSearch = vi.fn();
    const onSelect = vi.fn();
    const onSelectProject = vi.fn();
    const onSelectRecent = vi.fn();
    render(<CaptureProvider sink={recordingCapture().sink}><ConversationNavigation items={[{ id: "chat-1", label: "Planning" }]} projects={[{ id: "project-1", label: "Research" }]} recent={[{ id: "recent-1", label: "Recent work" }]} quota="Available" onHome={onHome} onNewChat={onNewChat} onSearch={onSearch} onSelect={onSelect} onSelectProject={onSelectProject} onSelectRecent={onSelectRecent} /></CaptureProvider>);
    await user.click(screen.getByRole("button", { name: "Home" }));
    await user.click(screen.getByRole("button", { name: "New chat" }));
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(screen.getByRole("button", { name: /Planning/ }));
    await user.click(screen.getByRole("button", { name: "Research" }));
    await user.click(screen.getByRole("button", { name: "Recent work" }));
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("chat-1");
    expect(onSelectProject).toHaveBeenCalledWith("project-1");
    expect(onSelectRecent).toHaveBeenCalledWith("recent-1");
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
