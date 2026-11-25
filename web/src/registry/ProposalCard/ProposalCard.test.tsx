// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CaptureProvider, recordingCapture, registry } from "../index";
import { ProposalCard } from "./ProposalCard";
import { events } from "./events";
import { meta } from "./meta";
import { propsSchema, slotsSchema } from "./schema";

const proposalId = "prop_123e4567-e89b-42d3-a456-426614174000";

describe("ProposalCard", () => {
  it("uses Card and Button primitives with keyboard-operable actions", async () => {
    const recorder = recordingCapture();
    const onKeep = vi.fn();
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<CaptureProvider sink={recorder.sink}><ProposalCard proposal_id={proposalId} proposal_type="look" title="Notebook look" description="A softer reading layout." preview="Preview content" onKeep={onKeep} onDismiss={onDismiss} /></CaptureProvider>);

    expect(screen.getByRole("region", { name: "Notebook look" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Proposal preview" }).textContent).toContain("Preview content");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep" }));
    await user.keyboard("{Enter}");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Dismiss" }));
    await user.keyboard("{Enter}");
    expect(onKeep).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(recorder.events).toEqual([
      { name: "component_shown", component: "ProposalCard", default_state: "preview" },
      { name: "proposal_shown", proposal_id: proposalId, proposal_type: "look" },
      { name: "proposal_kept", proposal_id: proposalId, proposal_type: "look" },
      { name: "proposal_dismissed", proposal_id: proposalId, proposal_type: "look" },
    ]);
  });

  it("validates every gallery example and rejects invalid props", () => {
    expect(propsSchema.safeParse({ proposal_id: proposalId, proposal_type: "dimension", title: "Change", description: "Details", preview: "Example." }).success).toBe(true);
    expect(propsSchema.safeParse({ proposal_id: proposalId, proposal_type: "dimension", title: "Change", description: "Details", preview: "" }).success).toBe(false);
    expect(propsSchema.safeParse({ proposal_id: proposalId, proposal_type: "dimension", title: "Change", description: "Details" }).success).toBe(false);
    expect(propsSchema.safeParse({ proposal_id: proposalId, proposal_type: "other", title: "Change", description: "Details" }).success).toBe(false);
    expect(slotsSchema.safeParse({}).success).toBe(true);
    expect(events).toContain("proposal_dismissed");
    const entry = registry.getSkeleton("ProposalCard")!;
    for (const state of entry.meta.galleryStates) {
      expect(entry.schema.safeParse({ props: state.props, slots: {} }).success).toBe(true);
      const view = render(<entry.Component props={state.props} slots={{}} />);
      expect(screen.getByRole("region", { name: String(state.props.title) })).toBeTruthy();
      view.unmount();
    }
    expect(entry.schema.safeParse({ props: { ...meta.galleryStates[0].props, proposal_type: "unknown" }, slots: {} }).success).toBe(false);
  });

  it("does not submit an enclosing form when a card action is activated", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const user = userEvent.setup();
    render(<form onSubmit={onSubmit}><ProposalCard proposal_id={proposalId} proposal_type="look" title="Proposal" description="Details" preview="Preview" onDismiss={vi.fn()} /></form>);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
