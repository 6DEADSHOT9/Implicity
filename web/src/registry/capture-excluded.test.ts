import { describe, expect, it, vi } from "vitest";
import { createValidatedCapture, type CaptureRegistry } from "./capture";

// A schema that one day adds the Stage 4 events must still not let them through
// until Stage 4: stand in for that schema with a validator that accepts anything.
vi.mock("../contracts/event-validator.js", () => ({ default: () => true }));

const registry: CaptureRegistry = { version: 7, entries: new Map() };
const context = { session_id: "123e4567-e89b-42d3-a456-426614174000", layout_version: 1 };

describe("Stage 4 exclusion on the capture path", () => {
  it("rejects widget and media events even when the validator accepts them", () => {
    const send = vi.fn();
    const capture = createValidatedCapture({ context, registry, send, ids: { has: () => false } });
    expect(capture({ name: "search_used" })).toBe(true);
    for (const name of ["widget_seen", "widget_used", "widget_pinned", "widget_dismissed", "media_played", "media_paused", "media_seeked", "media_replayed"]) {
      expect(capture({ name } as never), name).toBe(false);
    }
    expect(send).toHaveBeenCalledTimes(1);
  });
});
