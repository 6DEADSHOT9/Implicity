// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderLayout, renderMessage } from "../src/renderer";
import { registry } from "../src/registry";

afterEach(cleanup);

describe("layout recovery", () => {
  it("renders the real registry shell without a dead panel action", () => {
    render(renderLayout(undefined, undefined));
    expect(screen.getByText("Workspace unavailable. Showing the default workspace.")).toBeTruthy();
    expect(screen.getByRole("main").textContent).toContain("Workspace unavailable.");
    expect(screen.queryByRole("button", { name: /panel/i })).toBeNull();
  });
  it("rejects shell components anywhere in a message spec and shows plain text", () => {
    for (const type of ["AppShell", "ConversationNavigation", "ChatHeader", "Composer", "Search", "Settings"]) {
      const props = registry.getSkeleton(type)!.meta.galleryStates[0].props;
      const spec = { registry_version: registry.version, root: "shell", elements: { shell: { type, props } } };
      const view = render(renderMessage(spec, "Plain text fallback"));
      expect(screen.getByText("Plain text fallback"), type).toBeTruthy();
      view.unmount();
    }
    const nested = { registry_version: registry.version, root: "card", elements: { card: { type: "ProposalCard", props: { proposal_id: "prop_123e4567-e89b-42d3-a456-426614174000", proposal_type: "look", title: "Hello", description: "A description", preview: "A preview" } }, shell: { type: "Search", props: { open: true, results: [] } } } };
    render(renderMessage(nested, "Nested fallback"));
    expect(screen.getByText("Nested fallback")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    const malformedMixed = { registry_version: registry.version, root: "card", elements: { card: nested.elements.card, shell: { type: "Search" } } };
    const view = render(renderMessage(malformedMixed, "Malformed mixed fallback"));
    expect(screen.getByText("Malformed mixed fallback")).toBeTruthy();
    expect(screen.queryByText("Hello")).toBeNull();
    view.unmount();
  });
});
