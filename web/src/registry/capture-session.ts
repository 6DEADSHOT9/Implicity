import actions from "../../../contracts/actions.json" with { type: "json" };

export type LocalHourBucket = "night" | "morning" | "afternoon" | "evening";
export type SessionDisplay = { mode: "light" | "dark"; textScale: number };
export type SessionEvent = { name: "session_started" | "session_ended"; mode: "light" | "dark"; text_scale: number; local_hour_bucket: LocalHourBucket };
export type SessionStore = { getItem(key: string): string | null; setItem(key: string, value: string): void };

type SessionRecord = SessionDisplay & { id: string; localHourBucket: LocalHourBucket; started: boolean; ended: boolean; lastActivity: number };

export const SESSION_STORAGE_KEY = "implicity.session";

/**
 * Wraps browser storage so that a storage that is missing or throws (embedded
 * contexts, privacy modes, full quota) falls back to memory instead of
 * breaking capture or the page.
 */
export function safeSessionStore(open: () => Storage = () => sessionStorage): SessionStore {
  const memory = new Map<string, string>();
  const storage = () => { try { return open(); } catch { return undefined; } };
  return {
    getItem(key) {
      try { const value = storage()?.getItem(key); if (value !== null && value !== undefined) return value; } catch { /* use memory */ }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
      try { storage()?.setItem(key, value); } catch { /* memory keeps the value */ }
    },
  };
}

export function localHourBucket(at: Date): LocalHourBucket {
  const hour = at.getHours();
  return hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

export function readDisplay(): SessionDisplay {
  const root = document.querySelector<HTMLElement>("[data-gallery-root]") ?? document.documentElement;
  return { mode: root.dataset.mode === "dark" ? "dark" : "light", textScale: Math.min(5, Math.max(1, Number(root.dataset.textSize || 3))) };
}

/**
 * The one owner of the current session. The capture sink reads `id` when it
 * stamps each event and calls `ensureActive()` first, so the first event after
 * an idle period already carries the new session's id. Idle is judged from the
 * stored last-activity time compared with the clock, so a clock jump with no
 * timer firing (machine sleep, frozen tab) still ends the session.
 *
 * Every holder in a tab reads the stored record before it acts, so the gallery
 * and its preview frames share one session and only the first to act sends a
 * start or an end.
 *
 * The record lives in sessionStorage, so a reload keeps the id and sends
 * neither a start nor an end. Closing the tab sends no end: whether a late
 * end may be sent for a closed tab is an open question for the owner (F10).
 */
export function createSessionHolder({ store, emit, now = () => Date.now(), display = readDisplay, idleMilliseconds = actions.session_idle_milliseconds }: {
  store: SessionStore;
  emit: (event: SessionEvent) => void;
  now?: () => number;
  display?: () => SessionDisplay;
  idleMilliseconds?: number;
}) {
  let record = load() ?? fresh();

  function load(): SessionRecord | undefined {
    try {
      const saved = JSON.parse(store.getItem(SESSION_STORAGE_KEY) ?? "null") as SessionRecord | null;
      return saved && typeof saved.id === "string" && typeof saved.lastActivity === "number" ? saved : undefined;
    } catch { return undefined; }
  }
  function fresh(): SessionRecord {
    const at = now();
    return { id: crypto.randomUUID(), localHourBucket: localHourBucket(new Date(at)), ...display(), started: false, ended: false, lastActivity: at };
  }
  function save() { store.setItem(SESSION_STORAGE_KEY, JSON.stringify(record)); }
  /** Other holders in this tab (preview frames share sessionStorage) may have moved the session on. */
  function sync() { const saved = load(); if (saved) record = saved; }
  function fields(name: SessionEvent["name"]): SessionEvent {
    return { name, mode: record.mode, text_scale: record.textScale, local_hour_bucket: record.localHourBucket };
  }
  function isIdle() { return now() - record.lastActivity >= idleMilliseconds; }

  const holder = {
    get id() { sync(); return record.id; },
    /** Milliseconds until the current session would go idle without more input. */
    remaining() { sync(); return Math.max(0, record.lastActivity + idleMilliseconds - now()); },
    /** Ends the session once if it has been idle for the threshold. Starts nothing. */
    expireIfIdle() {
      sync();
      if (record.started && !record.ended && isIdle()) {
        emit(fields("session_ended"));
        record = { ...record, ended: true };
        save();
      }
    },
    /** Before any event is stamped: ends an idle session, rotates an ended one, and starts the current one once. */
    ensureActive() {
      holder.expireIfIdle();
      if (record.ended || (!record.started && isIdle())) record = fresh();
      if (!record.started) {
        record = { ...record, started: true };
        save();
        emit(fields("session_started"));
      }
    },
    /** User input: the session is active now. */
    activity() {
      holder.ensureActive();
      record = { ...record, lastActivity: now() };
      save();
    },
  };
  return holder;
}

export type SessionHolder = ReturnType<typeof createSessionHolder>;

const activityEvents = ["pointerdown", "keydown", "touchstart", "wheel", "scroll", "click"] as const;

/**
 * Wires a holder to the page: activity is heard in the capture phase, so it is
 * recorded before any handler on the target emits an event; a timer ends the
 * session at the idle threshold, and returning to the page checks the clock.
 */
export function watchSession(holder: SessionHolder, target: Window = window) {
  let timer = 0;
  const arm = () => {
    target.clearTimeout(timer);
    timer = target.setTimeout(() => { holder.expireIfIdle(); }, holder.remaining());
  };
  const onActivity = () => { holder.activity(); arm(); };
  const onReturn = () => { holder.expireIfIdle(); arm(); };
  const onVisibility = () => { if (target.document.visibilityState === "visible") onReturn(); };
  holder.ensureActive();
  arm();
  for (const name of activityEvents) target.addEventListener(name, onActivity, { capture: true, passive: true });
  target.addEventListener("pageshow", onReturn);
  target.document.addEventListener("visibilitychange", onVisibility);
  return () => {
    target.clearTimeout(timer);
    for (const name of activityEvents) target.removeEventListener(name, onActivity, { capture: true });
    target.removeEventListener("pageshow", onReturn);
    target.document.removeEventListener("visibilitychange", onVisibility);
  };
}
