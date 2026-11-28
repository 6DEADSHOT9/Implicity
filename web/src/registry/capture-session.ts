import actions from "../../../contracts/actions.json" with { type: "json" };

export type LocalHourBucket = "night" | "morning" | "afternoon" | "evening";
export type SessionDisplay = { mode: "light" | "dark"; textScale: number };
export type SessionEvent = { name: "session_started" | "session_ended"; mode: "light" | "dark"; text_scale: number; local_hour_bucket: LocalHourBucket };
/** The session id and time a session event is stamped with, which can differ from the current session (a late end). */
export type SessionStamp = { session_id: string; timestamp: number };
export type SessionStore = { getItem(key: string): string | null; setItem(key: string, value: string): void };
/** Runs `critical` exclusively across this origin's tabs, where the browser allows it. */
export type SessionLock = (name: string, critical: () => void) => void;

type SessionRecord = SessionDisplay & { id: string; localHourBucket: LocalHourBucket; lastActivity: number; lastEvent: number; ended: boolean };
type TabRecord = { id: string; released: boolean; started: boolean };

/** This tab's current session id, in sessionStorage: it survives a reload and goes away with the tab. */
export const TAB_SESSION_KEY = "implicity.session.tab";
/** Every unfinished (and recently ended) session of this origin, in localStorage: it survives a closed tab. */
export const SESSIONS_KEY = "implicity.sessions";
const END_LOCK = "implicity.session.end";
const KEEP_ENDED_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
/** The id this page (this frame's realm) has claimed, so mounting a provider twice never looks like a copied tab. */
const thisPage: { claimed?: string } = {};

/**
 * Wraps browser storage so that storage that is missing or throws (embedded
 * contexts, privacy modes, a full quota) falls back to memory instead of
 * breaking capture or the page. Once a write fails, this tab's value in memory
 * stays authoritative for that key until a later write succeeds, so a stale
 * readable value can never replace it.
 */
export function safeStore(open: () => Storage): SessionStore {
  const memory = new Map<string, string>();
  const unsaved = new Set<string>();
  return {
    getItem(key) {
      if (unsaved.has(key)) return memory.get(key) ?? null;
      try { return open().getItem(key) ?? memory.get(key) ?? null; } catch { return memory.get(key) ?? null; }
    },
    setItem(key, value) {
      memory.set(key, value);
      try { open().setItem(key, value); unsaved.delete(key); } catch { unsaved.add(key); }
    },
  };
}

/** Web Locks where available (secure contexts); otherwise the claim runs at once in this tab. */
export const browserLock: SessionLock = (name, critical) => {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) { critical(); return; }
  void locks.request(name, () => { critical(); }).catch(() => { /* the claim is skipped; a later scan retries */ });
};

export function localHourBucket(at: Date): LocalHourBucket {
  const hour = at.getHours();
  return hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

export function readDisplay(): SessionDisplay {
  const root = document.querySelector<HTMLElement>("[data-gallery-root]") ?? document.documentElement;
  return { mode: root.dataset.mode === "dark" ? "dark" : "light", textScale: Math.min(5, Math.max(1, Number(root.dataset.textSize || 3))) };
}

/**
 * The one owner of sessions for a page (ADR 0020, contracts.md "Events").
 *
 * - The capture sink reads `id` when it stamps each event and calls
 *   `ensureActive()` first, so the first event after idle carries a new id,
 *   after that id's one `session_started`.
 * - Idle is judged from the recorded last input against the clock, so a clock
 *   jump with no timer firing still ends the session.
 * - A reload keeps the tab's id and sends nothing. Nothing is sent at unload.
 * - An unfinished session stays in shared storage. Whichever page first finds
 *   it idle (the tab itself, another open tab, or a later load after the tab
 *   closed) claims it once and sends its one `session_ended`, stamped at the
 *   session's last activity, with the session's start fields.
 * - A tab that inherits another live tab's id (a duplicated tab, or one opened
 *   with copied session storage) gets its own id. The top page marks its tab
 *   record released at `pagehide`, so a reload can tell itself from a copy.
 * - Frames in a tab (the gallery's previews) share the top page's tab record.
 */
export function createSessionHolder({ tab, shared, emit, now = () => Date.now(), display = readDisplay, idleMilliseconds = actions.session_idle_milliseconds, top = true, lock = browserLock, newId = () => crypto.randomUUID(), page = thisPage }: {
  tab: SessionStore;
  shared: SessionStore;
  emit: (event: SessionEvent, stamp: SessionStamp) => void;
  now?: () => number;
  display?: () => SessionDisplay;
  idleMilliseconds?: number;
  top?: boolean;
  lock?: SessionLock;
  newId?: () => string;
  /** Which id this page has already claimed. Tests pass their own to stand for separate pages. */
  page?: { claimed?: string };
}) {
  const listeners = new Set<() => void>();
  let current = claimTab();

  function parse<T>(key: string, store: SessionStore): T | undefined {
    try { return JSON.parse(store.getItem(key) ?? "null") ?? undefined; } catch { return undefined; }
  }
  function readTab() { const saved = parse<TabRecord>(TAB_SESSION_KEY, tab); return saved && typeof saved.id === "string" ? saved : undefined; }
  function writeTab(record: TabRecord) { tab.setItem(TAB_SESSION_KEY, JSON.stringify(record)); }
  function readAll(): Record<string, SessionRecord> { return parse<Record<string, SessionRecord>>(SESSIONS_KEY, shared) ?? {}; }
  function writeAll(records: Record<string, SessionRecord>) { shared.setItem(SESSIONS_KEY, JSON.stringify(records)); }
  function update(id: string, change: (record: SessionRecord) => SessionRecord) {
    const all = readAll();
    if (all[id]) { all[id] = change(all[id]); writeAll(all); }
  }
  function notify() { for (const listener of listeners) listener(); }
  function isIdle(record: SessionRecord, at = now()) { return at - record.lastActivity >= idleMilliseconds; }

  function claimTab(): string {
    const saved = readTab();
    if (saved && (!top || saved.released || page.claimed === saved.id)) {
      if (top) writeTab({ ...saved, released: false });
      page.claimed = saved.id;
      return saved.id;
    }
    // A first load, or a tab that copied a live tab's record: never share its id.
    const id = newId();
    writeTab({ id, released: false, started: false });
    page.claimed = id;
    return id;
  }
  function sync() { const saved = readTab(); if (saved) current = saved.id; }

  function claimEnd(id: string) {
    lock(END_LOCK, () => {
      const all = readAll();
      const record = all[id];
      if (!record || record.ended || !isIdle(record)) return;
      all[id] = { ...record, ended: true };
      writeAll(all);
      emit({ name: "session_ended", mode: record.mode, text_scale: record.textScale, local_hour_bucket: record.localHourBucket }, { session_id: id, timestamp: Math.max(record.lastActivity, record.lastEvent) });
      notify();
    });
  }

  const holder = {
    get id() { sync(); return current; },
    /** Milliseconds until the next unfinished session in this origin goes idle, or Infinity when none is open. */
    remaining() {
      const at = now();
      const deadlines = Object.values(readAll()).filter((record) => !record.ended).map((record) => record.lastActivity + idleMilliseconds - at);
      return deadlines.length ? Math.max(0, Math.min(...deadlines)) : Number.POSITIVE_INFINITY;
    },
    /** Ends, once across tabs, every session that has been idle for the threshold. Starts nothing. */
    expireIdle() {
      const at = now();
      for (const record of Object.values(readAll())) if (!record.ended && isIdle(record, at)) claimEnd(record.id);
      const all = readAll();
      const kept = Object.fromEntries(Object.entries(all).filter(([, record]) => !record.ended || at - record.lastActivity < KEEP_ENDED_MILLISECONDS));
      if (Object.keys(kept).length !== Object.keys(all).length) writeAll(kept);
    },
    /** Before any event is stamped: ends idle sessions, rotates an ended one, and starts the current one once. */
    ensureActive() {
      sync();
      holder.expireIdle();
      const record = readAll()[current];
      if (record && !record.ended) return;
      if (record?.ended || readTab()?.started) current = newId();
      const at = now();
      const started: SessionRecord = { id: current, localHourBucket: localHourBucket(new Date(at)), ...display(), lastActivity: at, lastEvent: at, ended: false };
      writeAll({ ...readAll(), [current]: started });
      writeTab({ id: current, released: false, started: true });
      page.claimed = current;
      emit({ name: "session_started", mode: started.mode, text_scale: started.textScale, local_hour_bucket: started.localHourBucket }, { session_id: current, timestamp: at });
      notify();
    },
    /** User input: the session is active now. */
    activity() {
      holder.ensureActive();
      const at = now();
      update(current, (record) => ({ ...record, lastActivity: at }));
      notify();
    },
    /** An event was sent on the current session at `at`. */
    recordEvent(at = now()) { update(current, (record) => ({ ...record, lastEvent: Math.max(record.lastEvent, at) })); },
    /** At `pagehide`: lets a reload of this tab keep its id. A storage write only; nothing is sent. */
    release() { if (top) { const saved = readTab(); if (saved) writeTab({ ...saved, released: true }); } },
    /** At a back/forward cache restore: this page holds the tab's id again. */
    reclaim() { if (top) { const saved = readTab(); if (saved) writeTab({ ...saved, released: false }); } },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  return holder;
}

export type SessionHolder = ReturnType<typeof createSessionHolder>;

const activityEvents = ["pointerdown", "keydown", "touchstart", "wheel", "scroll", "click"] as const;

/**
 * Wires a holder to the page. Activity is heard in the capture phase, so it is
 * recorded before any handler on the target emits an event. One timer follows
 * the holder: it is re-armed whenever the holder starts, ends or records
 * activity, and when another tab changes shared storage; a timer that wakes
 * early against newer activity schedules the remaining time.
 */
export function watchSession(holder: SessionHolder, target: Window = window) {
  let timer = 0;
  const arm = () => {
    target.clearTimeout(timer);
    const wait = holder.remaining();
    if (Number.isFinite(wait)) timer = target.setTimeout(wake, wait);
  };
  const wake = () => { holder.expireIdle(); arm(); };
  const unsubscribe = holder.subscribe(arm);
  const onActivity = () => { holder.activity(); };
  const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) holder.reclaim(); wake(); };
  const onPageHide = () => { holder.release(); };
  const onVisibility = () => { if (target.document.visibilityState === "visible") wake(); };
  const onStorage = (event: StorageEvent) => { if (event.key === SESSIONS_KEY) arm(); };
  holder.ensureActive();
  arm();
  for (const name of activityEvents) target.addEventListener(name, onActivity, { capture: true, passive: true });
  target.addEventListener("pageshow", onPageShow);
  target.addEventListener("pagehide", onPageHide);
  target.addEventListener("storage", onStorage);
  target.document.addEventListener("visibilitychange", onVisibility);
  return () => {
    unsubscribe();
    target.clearTimeout(timer);
    for (const name of activityEvents) target.removeEventListener(name, onActivity, { capture: true });
    target.removeEventListener("pageshow", onPageShow);
    target.removeEventListener("pagehide", onPageHide);
    target.removeEventListener("storage", onStorage);
    target.document.removeEventListener("visibilitychange", onVisibility);
  };
}
