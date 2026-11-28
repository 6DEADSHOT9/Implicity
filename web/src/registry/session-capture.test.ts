// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { startSessionLifecycle } from "./capture";
import actions from "../../../contracts/actions.json" with { type: "json" };

const session = { id: "123e4567-e89b-42d3-a456-426614174000", mode: "dark" as const, textScale: 4, localHourBucket: "morning" as const };

afterEach(() => { vi.useRealTimers(); sessionStorage.clear(); });

describe("session capture lifecycle", () => {
  it("keeps one start across a reload and ends at most once on close with the start bucket", () => {
    const events: Array<{ name: string; local_hour_bucket: string }> = [];
    const emit = (event: { name: string; local_hour_bucket: string }) => { events.push(event); };
    const firstCleanup = startSessionLifecycle(session, emit);
    firstCleanup();
    const secondCleanup = startSessionLifecycle(session, emit);
    const close = new Event("pagehide") as PageTransitionEvent;
    Object.defineProperty(close, "persisted", { value: false });
    window.dispatchEvent(close);
    window.dispatchEvent(close);
    secondCleanup();
    expect(events.map(({ name }) => name)).toEqual(["session_started", "session_ended"]);
    expect(events.map(({ local_hour_bucket }) => local_hour_bucket)).toEqual(["morning", "morning"]);
  });

  it("ends after the contract idle threshold and starts a fresh id on the next activity", () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const onNewSession = vi.fn();
    const cleanup = startSessionLifecycle(session, emit, window, sessionStorage, onNewSession);
    vi.advanceTimersByTime(actions.session_idle_milliseconds - 1);
    expect(emit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(emit.mock.calls.map(([event]) => event.name)).toEqual(["session_started", "session_ended"]);
    window.dispatchEvent(new Event("click"));
    expect(onNewSession).toHaveBeenCalledOnce();
    cleanup();
  });

  it("re-arms activity tracking after a back-forward cache restore", () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const cleanup = startSessionLifecycle(session, emit);
    const persisted = new Event("pagehide") as PageTransitionEvent;
    Object.defineProperty(persisted, "persisted", { value: true });
    window.dispatchEvent(persisted);
    const restored = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(restored, "persisted", { value: true });
    window.dispatchEvent(restored);
    vi.advanceTimersByTime(actions.session_idle_milliseconds);
    expect(emit.mock.calls.map(([event]) => event.name)).toEqual(["session_started", "session_ended"]);
    cleanup();
  });
});
