import { describe, expect, it, vi } from "vitest";
import { createValidatedCapture, getInputType, sanitizePostHogEvent, type CaptureRegistry } from "./capture";

const context = { session_id: "123e4567-e89b-42d3-a456-426614174000", layout_version: 1 };
const registry: CaptureRegistry = { version: 7, entries: new Map([
  ["Details", { meta: { slots: ["details"], defaultStates: ["folded", "open"], commands: [] } }],
  ["Composer", { meta: { slots: [], defaultStates: ["empty"], commands: ["search"] } }],
]) };

describe("validated capture", () => {
  it("maps initial pointer capabilities to the closed input vocabulary", () => {
    expect(["fine", "coarse", "none", undefined].map(getInputType)).toEqual(["mouse", "touch", "none", "none"]);
  });

  it("adds shared fields and rejects malformed or content-bearing events", () => {
    const send = vi.fn();
    const capture = createValidatedCapture({ context, registry, send, ids: { has: () => false } });
    expect(capture({ name: "search_used" })).toBe(true);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      name: "search_used", session_id: context.session_id, layout_version: 1,
      contracts_version: 1, registry_version: 7, device_class: expect.any(String), input_type: expect.any(String),
    }));
    expect(capture({ name: "message_sent", message: "private text" } as never)).toBe(false);
    expect(capture({ name: "attachment_added", attachment_id: "123e4567-e89b-42d3-a456-426614174000", type: "image", filename: "private.png" } as never)).toBe(false);
    expect(capture({ name: "shortcut_used", command: "copy", key: "Control+C" } as never)).toBe(false);
    expect(capture({ name: "media_played" } as never)).toBe(false);
  });

  it("accepts only registry-owned fixed values and app-verified opaque ids", () => {
    const send = vi.fn();
    const capture = createValidatedCapture({ context, registry, send, ids: { has: (_kind, id) => id === "cmd_123e4567-e89b-42d3-a456-426614174000" } });
    expect(capture({ name: "component_seen", component: "Details", slot: "details", default_state: "folded", seconds_visible: 3.16 })).toBe(true);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ seconds_visible: 3.2 }));
    expect(capture({ name: "component_seen", component: "Details", slot: "invented", default_state: "folded", seconds_visible: 3 })).toBe(false);
    expect(capture({ name: "component_seen", component: "Details", slot: "details", default_state: "made_up", seconds_visible: 3 })).toBe(false);
    expect(capture({ name: "shortcut_used", command: "cmd_123e4567-e89b-42d3-a456-426614174000" })).toBe(true);
    expect(capture({ name: "shortcut_used", command: "cmd_123e4567-e89b-42d3-a456-426614174001" })).toBe(false);
    expect(capture({ name: "shortcut_used", command: "search" })).toBe(true);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("omits events from session ids the owner excludes", () => {
    const send = vi.fn();
    const capture = createValidatedCapture({ context, registry, send, ids: { has: () => false }, excludedSessionIds: [context.session_id] });
    expect(capture({ name: "search_used" })).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("strips SDK-added properties and revalidates the final event", () => {
    const event = { properties: { name: "search_used", event_id: "123e4567-e89b-42d3-a456-426614174000", timestamp: "2026-11-28T00:00:00.000Z", contracts_version: 1, session_id: context.session_id, layout_version: 1, registry_version: 7, device_class: "desktop", input_type: "none", $current_url: "/private-message", filename: "private.png", key: "Control+C" } };
    expect(sanitizePostHogEvent(event)).toBe(event);
    expect(event.properties).not.toHaveProperty("$current_url");
    expect(event.properties).not.toHaveProperty("filename");
    expect(event.properties).not.toHaveProperty("key");
    expect(sanitizePostHogEvent({ properties: { name: "search_used", message: "private text" } })).toBeNull();
  });
});
