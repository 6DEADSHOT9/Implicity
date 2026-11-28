// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createValidatedCapture, type CaptureRegistry } from "./capture";
import { deviceClass } from "./capture-rules";

const registry: CaptureRegistry = { version: 7, entries: new Map([
  ["Details", { meta: { slots: ["details"], defaultStates: ["folded"], commands: [] } }],
  ["Composer", { meta: { slots: [], defaultStates: ["empty"], commands: ["search"] } }],
]) };
const context = { session_id: "123e4567-e89b-42d3-a456-426614174000", layout_version: 1 };

describe("browser capture", () => {
  it("classifies both sides of the shared desktop breakpoint", () => {
    expect([1023, 1024].map(deviceClass)).toEqual(["tablet", "desktop"]);
  });

  it("tracks the last pointer type and attaches shared fields in a browser", () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn().mockReturnValue({ matches: false }) });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1023 });
    const send = vi.fn();
    const capture = createValidatedCapture({ context, registry, send, ids: { has: () => false } });
    const pointer = new Event("pointerdown");
    Object.defineProperty(pointer, "pointerType", { value: "touch" });
    window.dispatchEvent(pointer);
    expect(capture({ name: "search_used" })).toBe(true);
    expect(send.mock.calls[0][0]).toEqual(expect.objectContaining({ input_type: "touch", device_class: "tablet" }));
  });

  it("validates the named component, each app kind, and app-minted decision ids", () => {
    const send = vi.fn();
    const capture = createValidatedCapture({ context: { ...context, kind: "kind_123e4567-e89b-42d3-a456-426614174000" }, registry, send, ids: { has: (type, id) => type === "kind" && id === "kind_123e4567-e89b-42d3-a456-426614174000" || type === "decision" && id === "dec_123e4567-e89b-42d3-a456-426614174000" } });
    expect(capture({ name: "component_shown", component: "Unknown", default_state: "default" })).toBe(false);
    expect(capture({ name: "component_shown", component: "Details", default_state: "folded" })).toBe(true);
    expect(capture({ name: "change_shown", decision_id: "dec_223e4567-e89b-42d3-a456-426614174000" })).toBe(false);
    expect(capture({ name: "change_shown", decision_id: "dec_123e4567-e89b-42d3-a456-426614174000" })).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
