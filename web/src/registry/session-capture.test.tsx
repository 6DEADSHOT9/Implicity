// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import posthog from "posthog-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import actions from "../../../contracts/actions.json" with { type: "json" };
import { BrowserCaptureProvider, useCapture, type CaptureRegistry } from "./capture";
import { SESSION_STORAGE_KEY } from "./capture-session";

vi.mock("posthog-js", () => ({ default: { init: vi.fn(), capture: vi.fn() } }));

const registry: CaptureRegistry = { version: 7, entries: new Map() };
const idle = actions.session_idle_milliseconds;
type Sent = { name: string; session_id: string; local_hour_bucket?: string };

function Probe() {
  const { emit } = useCapture<"search_used">();
  return <button onClick={() => emit("search_used", {})}>Emit</button>;
}

/** What reached the SDK, in order. Settles the lazy SDK import first. */
async function sent(): Promise<Sent[]> {
  await act(async () => {
    await vi.dynamicImportSettled();
    for (let tick = 0; tick < 5; tick += 1) await Promise.resolve();
  });
  return vi.mocked(posthog.capture).mock.calls.map(([name, properties]) => ({ name, ...(properties as Omit<Sent, "name">) }));
}

/** No event may carry a session id after that id's session_ended. */
function expectNothingAfterEnd(events: Sent[]) {
  const ended = new Set<string>();
  for (const event of events) {
    expect(ended.has(event.session_id), `${event.name} after ${event.session_id} ended`).toBe(false);
    if (event.name === "session_ended") ended.add(event.session_id);
  }
}

// Capture is on unless a caller turns it off, so the app's provider records without an opt-in.
function mount(props: Partial<Parameters<typeof BrowserCaptureProvider>[0]> = {}) {
  return render(<BrowserCaptureProvider registry={registry} {...props}><Probe /></BrowserCaptureProvider>);
}

const click = () => act(() => { screen.getByRole("button", { name: "Emit" }).click(); });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date(2026, 10, 28, 9, 0, 0));
  vi.stubEnv("VITE_POSTHOG_API_KEY", "test-project-token");
  vi.stubEnv("VITE_POSTHOG_HOST", "http://posthog.test");
  vi.mocked(posthog.capture).mockClear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("browser capture provider", () => {
  it("sends session_started and then events stamped with that session when enabled with a key", async () => {
    mount();
    click();
    const events = await sent();
    expect(events.map(({ name }) => name)).toEqual(["session_started", "search_used"]);
    expect(events[1].session_id).toBe(events[0].session_id);
    expect(events[0].local_hour_bucket).toBe("morning");
    expect(posthog.init).toHaveBeenCalledWith("test-project-token", expect.objectContaining({ api_host: "http://posthog.test", autocapture: false }));
  });

  it("sends nothing at all in a temporary chat, even with a key and capture enabled", async () => {
    mount({ temporary: true });
    click();
    await act(async () => { vi.advanceTimersByTime(idle); });
    expect(await sent()).toEqual([]);
  });

  it("sends nothing when capture is turned off, as the gallery does unless it opts in", async () => {
    mount({ enabled: false });
    click();
    expect(await sent()).toEqual([]);
  });

  it("ends an idle session once, and the first event after it carries a new session after exactly one start", async () => {
    mount();
    vi.advanceTimersByTime(idle - 1);
    expect((await sent()).map(({ name }) => name)).toEqual(["session_started"]);
    act(() => { vi.advanceTimersByTime(1); });
    click();
    click();
    act(() => { window.dispatchEvent(new Event("pointerdown")); });
    const events = await sent();
    expect(events.map(({ name }) => name)).toEqual(["session_started", "session_ended", "session_started", "search_used", "search_used"]);
    expect(events[1].session_id).toBe(events[0].session_id);
    expect(new Set(events.slice(2).map(({ session_id }) => session_id)).size).toBe(1);
    expect(events[2].session_id).not.toBe(events[0].session_id);
    expectNothingAfterEnd(events);

    act(() => { vi.advanceTimersByTime(idle); });
    const later = await sent();
    expect(later.slice(5)).toEqual([expect.objectContaining({ name: "session_ended", session_id: events[2].session_id })]);
  });

  it("ends and rotates the session after a clock jump with no timer firing", async () => {
    mount();
    click();
    vi.setSystemTime(Date.now() + 8 * 60 * 60 * 1000);
    click();
    const events = await sent();
    expect(events.map(({ name }) => name)).toEqual(["session_started", "search_used", "session_ended", "session_started", "search_used"]);
    expect(events[2].session_id).toBe(events[0].session_id);
    expect(events[4].session_id).toBe(events[3].session_id);
    expect(events[3].session_id).not.toBe(events[0].session_id);
    expectNothingAfterEnd(events);
  });

  it("hears activity in the capture phase, before a handler that stops propagation", async () => {
    mount();
    vi.advanceTimersByTime(idle / 2);
    const inner = document.createElement("div");
    document.body.append(inner);
    inner.addEventListener("pointerdown", (event) => event.stopPropagation());
    act(() => { inner.dispatchEvent(new Event("pointerdown", { bubbles: true })); });
    act(() => { vi.advanceTimersByTime(idle / 2 + 1); });
    expect((await sent()).map(({ name }) => name)).toEqual(["session_started"]);
    inner.remove();
  });

  it("keeps the session id across a reload and sends neither a start nor an end", async () => {
    const first = mount();
    click();
    const pagehide = new Event("pagehide") as PageTransitionEvent;
    Object.defineProperty(pagehide, "persisted", { value: false });
    act(() => { window.dispatchEvent(pagehide); });
    first.unmount();
    mount();
    click();
    const events = await sent();
    expect(events.map(({ name }) => name)).toEqual(["session_started", "search_used", "search_used"]);
    expect(new Set(events.map(({ session_id }) => session_id)).size).toBe(1);
    expect(JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) ?? "{}")).toMatchObject({ id: events[0].session_id, ended: false });
  });

  it("renders and still captures when session storage throws", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "sessionStorage")!;
    Object.defineProperty(window, "sessionStorage", { configurable: true, get() { throw new DOMException("denied", "SecurityError"); } });
    try {
      mount();
      click();
      expect((await sent()).map(({ name }) => name)).toEqual(["session_started", "search_used"]);
    } finally {
      Object.defineProperty(window, "sessionStorage", descriptor);
    }
  });
});
