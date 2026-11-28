// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import actions from "../../../contracts/actions.json" with { type: "json" };
import { createSessionHolder, watchSession, type SessionEvent, type SessionLock, type SessionStamp, type SessionStore } from "./capture-session";

const idle = actions.session_idle_milliseconds;
type Sent = SessionEvent & SessionStamp;

function memoryStore(from?: SessionStore & { dump(): Map<string, string> }): SessionStore & { dump(): Map<string, string> } {
  const values = new Map(from?.dump());
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, dump: () => values };
}

let sent: Sent[];
let shared: ReturnType<typeof memoryStore>;
let ids: number;

/** One page: its own tab store (sessionStorage) and claim, the origin's shared store (localStorage). */
function page({ tab = memoryStore(), top = true, lock }: { tab?: ReturnType<typeof memoryStore>; top?: boolean; lock?: SessionLock } = {}) {
  const holder = createSessionHolder({
    tab, shared, top, page: {}, display: () => ({ mode: "dark", textScale: 4 }),
    emit: (event, stamp) => { sent.push({ ...event, ...stamp }); },
    newId: () => `00000000-0000-4000-8000-${String((ids += 1)).padStart(12, "0")}`,
    ...(lock ? { lock } : {}),
  });
  return { holder, tab };
}

const names = () => sent.map(({ name, session_id }) => `${name} ${session_id.slice(-2)}`);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(new Date(2026, 10, 28, 9, 0, 0));
  sent = [];
  shared = memoryStore();
  ids = 0;
});

afterEach(() => { vi.useRealTimers(); });

describe("session lifecycle across pages and tabs", () => {
  it("keeps the tab's id across a reload and sends neither a start nor an end", () => {
    const first = page();
    const stopFirst = watchSession(first.holder);
    window.dispatchEvent(Object.assign(new Event("pagehide"), { persisted: false }));
    stopFirst();
    const reloaded = page({ tab: first.tab });
    const stopReloaded = watchSession(reloaded.holder);
    stopReloaded();
    expect(reloaded.holder.id).toBe(first.holder.id);
    expect(names()).toEqual(["session_started 01"]);
  });

  it("ends a closed tab's session once from a later load, at its last activity, with its start fields", () => {
    const closed = page();
    closed.holder.ensureActive();
    vi.advanceTimersByTime(60_000);
    closed.holder.activity();
    const lastActivity = Date.now();
    vi.setSystemTime(new Date(2026, 10, 28, 20, 0, 0));
    const later = page();
    later.holder.ensureActive();
    expect(names()).toEqual(["session_started 01", "session_ended 01", "session_started 02"]);
    expect(sent[1]).toMatchObject({ timestamp: lastActivity, local_hour_bucket: "morning", mode: "dark", text_scale: 4 });
    expect(sent[2]).toMatchObject({ local_hour_bucket: "evening" });
  });

  it("ends a closed tab's session from an already open tab when its deadline passes", () => {
    const open = page();
    const stopOpen = watchSession(open.holder);
    const closed = page();
    closed.holder.ensureActive();
    vi.advanceTimersByTime(idle / 2);
    open.holder.activity();
    expect(names()).toEqual(["session_started 01", "session_started 02"]);
    vi.advanceTimersByTime(idle / 2);
    expect(names()).toEqual(["session_started 01", "session_started 02", "session_ended 02"]);
    expect(sent[2].timestamp).toBe(new Date(2026, 10, 28, 9, 0, 0).getTime());
    stopOpen();
  });

  it("sends one end in total when two pages claim the same idle session at once", () => {
    const closed = page();
    closed.holder.ensureActive();
    vi.advanceTimersByTime(idle);
    const queue: Array<() => void> = [];
    const deferred: SessionLock = (_name, critical) => { queue.push(critical); };
    const first = page({ lock: deferred });
    const second = page({ lock: deferred });
    first.holder.expireIdle();
    second.holder.expireIdle();
    expect(queue).toHaveLength(2);
    queue.forEach((critical) => critical());
    expect(sent.filter(({ name }) => name === "session_ended").map(({ session_id }) => session_id)).toEqual([closed.holder.id]);
  });

  it("gives a duplicated tab its own id, with one start per id", () => {
    const original = page();
    original.holder.ensureActive();
    const duplicate = page({ tab: memoryStore(original.tab) });
    duplicate.holder.ensureActive();
    original.holder.ensureActive();
    expect(duplicate.holder.id).not.toBe(original.holder.id);
    expect(names()).toEqual(["session_started 01", "session_started 02"]);
  });

  it("still ends the session at the updated deadline after the frame that recorded activity is removed", () => {
    const top = page();
    const stopTop = watchSession(top.holder);
    const frame = page({ tab: top.tab, top: false });
    const stopFrame = watchSession(frame.holder);
    vi.advanceTimersByTime(idle / 2);
    frame.holder.activity();
    stopFrame();
    vi.advanceTimersByTime(idle / 2);
    expect(names()).toEqual(["session_started 01"]);
    vi.advanceTimersByTime(idle / 2);
    expect(names()).toEqual(["session_started 01", "session_ended 01"]);
    stopTop();
  });
});
