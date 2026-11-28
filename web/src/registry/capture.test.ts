import { describe, expect, it, vi } from "vitest";
import { createValidatedCapture, getInputType, isExcludedEvent, sanitizePostHogEvent, type CaptureRegistry } from "./capture";

const context = { session_id: "123e4567-e89b-42d3-a456-426614174000", layout_version: 1 };
const registry: CaptureRegistry = { version: 7, entries: new Map([
  ["Details", { meta: { slots: ["details"], defaultStates: ["folded", "open"], commands: [] } }],
  ["Composer", { meta: { slots: [], defaultStates: ["empty"], commands: ["search"] } }],
  ["ShortcutChips", { meta: { slots: [], defaultStates: ["suggested"], commands: ["copy_answer", "regenerate_answer"] } }],
]) };

describe("validated capture", () => {
  it("maps initial pointer capabilities to the closed input vocabulary", () => {
    expect(["fine", "coarse", "none", undefined].map(getInputType)).toEqual(["mouse", "touch", "none", "none"]);
  });

  it("keeps Stage 4 widget and media events excluded even when schemas add them", () => {
    expect(["widget_seen", "widget_used", "widget_pinned", "widget_dismissed", "media_played", "media_paused", "media_seeked", "media_replayed"].every(isExcludedEvent)).toBe(true);
  });

  it("adds shared fields and rejects malformed or content-bearing events", () => {
    const send = vi.fn();
    const capture = createValidatedCapture({ context, registry, send, ids: { has: () => false } });
    expect(capture({ name: "search_used" })).toBe(true);
    expect(send.mock.calls[0][0]).toEqual(expect.objectContaining({
      name: "search_used", session_id: context.session_id, layout_version: 1,
      contracts_version: 1, registry_version: 7, device_class: expect.any(String), input_type: expect.any(String),
    }));
    expect(capture({ name: "message_sent", message: "private text", length_bucket: "short", command: "search" } as never)).toBe(false);
    expect(capture({ name: "attachment_added", attachment_id: "123e4567-e89b-42d3-a456-426614174000", type: "image", filename: "private.png" } as never)).toBe(false);
    expect(capture({ name: "shortcut_used", command: "copy", key: "Control+C" } as never, "ShortcutChips")).toBe(false);
    expect(capture({ name: "media_played" } as never)).toBe(false);
    for (const [name, slot] of [["search_used", "my-bank-password-hunter2"], ["message_sent", "tell_alice_i_am_leaving"], ["attachment_added", "divorce-papers_pdf"], ["shortcut_used", "ctrl-shift-k"]] as const) {
      const base = name === "message_sent" ? { length_bucket: "short", attachment_count: 0 } : name === "attachment_added" ? { type: "document" } : name === "shortcut_used" ? { command: "search" } : {};
      expect(capture({ name, ...base } as never, name === "shortcut_used" ? "ShortcutChips" : undefined)).toBe(true);
      expect(capture({ name, ...base, slot } as never, name === "shortcut_used" ? "ShortcutChips" : undefined)).toBe(false);
    }
  });

  it("passes the shared conversation and kind fields through validation", () => {
    const send = vi.fn();
    const capture = createValidatedCapture({ context: { ...context, conversation_id: "223e4567-e89b-42d3-a456-426614174000", kind: "coding" }, registry, send, ids: { has: () => false } });
    expect(capture({ name: "search_used" })).toBe(true);
    expect(send.mock.calls[0][0]).toEqual(expect.objectContaining({ conversation_id: "223e4567-e89b-42d3-a456-426614174000", kind: "coding" }));
  });

  it("accepts only registry-owned fixed values and app-verified opaque ids", () => {
    const send = vi.fn();
    const capture = createValidatedCapture({ context, registry, send, ids: { has: (_kind, id) => id === "cmd_123e4567-e89b-42d3-a456-426614174000" } });
    expect(capture({ name: "component_seen", component: "Details", slot: "details", default_state: "folded", seconds_visible: 3.16 })).toBe(true);
    expect(send.mock.calls[0][0]).toEqual(expect.objectContaining({ seconds_visible: 3.2 }));
    expect(capture({ name: "component_seen", component: "Details", slot: "invented", default_state: "folded", seconds_visible: 3 })).toBe(false);
    expect(capture({ name: "component_seen", component: "Details", slot: "details", default_state: "made_up", seconds_visible: 3 })).toBe(false);
    expect(capture({ name: "shortcut_used", command: "cmd_123e4567-e89b-42d3-a456-426614174000" }, "ShortcutChips")).toBe(true);
    expect(capture({ name: "shortcut_used", command: "cmd_123e4567-e89b-42d3-a456-426614174001" }, "ShortcutChips")).toBe(false);
    expect(capture({ name: "shortcut_used", command: "search" }, "ShortcutChips")).toBe(true);
    expect(capture({ name: "shortcut_used", command: "search" }, "Composer")).toBe(true);
    expect(capture({ name: "shortcut_used", command: "copy_answer" }, "ShortcutChips")).toBe(true);
    expect(capture({ name: "shortcut_used", command: "copy_answer" }, "Composer")).toBe(false);
    expect(send).toHaveBeenCalledTimes(5);
  });

  it("strips SDK-added properties and revalidates the final event", () => {
    const event = { properties: { name: "search_used", event_id: "123e4567-e89b-42d3-a456-426614174000", timestamp: "2026-11-28T00:00:00.000Z", contracts_version: 1, session_id: context.session_id, layout_version: 1, registry_version: 7, device_class: "desktop", input_type: "none", token: "test-token", distinct_id: "test-id", $current_url: "/private-message", filename: "private.png", key: "Control+C" }, $set: { email: "secret" }, $set_once: { email: "secret" } };
    expect(sanitizePostHogEvent(event)).toBe(event);
    expect(event.properties).not.toHaveProperty("$current_url");
    expect(event.properties).not.toHaveProperty("filename");
    expect(event.properties).not.toHaveProperty("key");
    expect(event.properties).toMatchObject({ token: "test-token", distinct_id: "test-id" });
    expect(event).not.toHaveProperty("$set");
    expect(event).not.toHaveProperty("$set_once");
    expect(sanitizePostHogEvent({ properties: { name: "search_used", message: "private text" } })).toBeNull();
  });

  it("checks every custom kind in a session summary and proposal and decision ids", () => {
    const customKind = "kind_123e4567-e89b-42d3-a456-426614174000";
    const proposalId = "prop_123e4567-e89b-42d3-a456-426614174000";
    const decisionId = "dec_123e4567-e89b-42d3-a456-426614174000";
    const acceptedIds = { has: (type: string, id: string) => (type === "kind" && id === customKind) || (type === "proposal" && id === proposalId) || (type === "decision" && id === decisionId) };
    const capture = createValidatedCapture({ context, registry, send: vi.fn(), ids: acceptedIds });
    const summary = { name: "session_summary", duration: 60, active_time: 30, turns: 1, kinds: ["coding", customKind, "kind_223e4567-e89b-42d3-a456-426614174000"], local_hour_bucket: "morning", day_type: "weekday", typing: { composing_time: 10, mean_key_gap: 1, key_gap_spread: 0, burst_count: 1, pause_count: 0, backspace_rate: 0 } } as const;
    expect(capture(summary as never)).toBe(false);
    expect(capture({ ...summary, kinds: ["coding", customKind] } as never)).toBe(true);
    expect(capture({ name: "proposal_shown", proposal_id: proposalId, proposal_type: "look" })).toBe(true);
    expect(capture({ name: "proposal_shown", proposal_id: "prop_223e4567-e89b-42d3-a456-426614174000", proposal_type: "look" })).toBe(false);
    expect(capture({ name: "change_shown", decision_id: decisionId })).toBe(true);
    expect(capture({ name: "change_shown", decision_id: "dec_223e4567-e89b-42d3-a456-426614174000" })).toBe(false);
  });
});
