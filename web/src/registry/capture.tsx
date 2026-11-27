import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "../../../contracts/schemas/index.json" with { type: "json" };
import type { Event } from "../contracts/generated";
import type { SkeletonEntry } from "./define-skeleton";
import { DEVICE_CLASS_BREAKPOINT, SECONDS_DECIMAL_PLACES, SEEN_VISIBLE_RATIO, SEEN_VISIBLE_SECONDS } from "./capture-rules";
import actions from "../../../contracts/actions.json" with { type: "json" };

type SharedField = "event_id" | "timestamp" | "contracts_version" | "session_id" | "conversation_id" | "kind" | "layout_version" | "registry_version" | "device_class" | "input_type";
export type EventName = Event["name"];
export type CapturedEvent<N extends EventName = EventName> = N extends EventName ? Omit<Extract<Event, { name: N }>, SharedField> : never;
export type CaptureSink = (event: CapturedEvent) => void;
export type AppIdType = "command" | "kind" | "proposal" | "decision";
export type CaptureRegistry = { version: number; entries: ReadonlyMap<string, { meta: Pick<SkeletonEntry["meta"], "slots" | "defaultStates" | "commands"> }> };
export type CaptureContextValue = Pick<Event, "session_id" | "layout_version"> & Pick<Partial<Event>, "conversation_id" | "kind">;

const CaptureContext = createContext<CaptureSink>(() => {});
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateEvent = ajv.compile<Event>({ ...schema, $ref: "https://implicity.local/contracts/#/$defs/Event" });
const eventSchema = schema as unknown as { $defs: Record<string, { oneOf?: Array<{ $ref: string }>; properties?: Record<string, { const?: string }> }> };
const eventProperties = new Map<string, Set<string>>();
for (const { $ref } of eventSchema.$defs.Event.oneOf ?? []) {
  const definition = eventSchema.$defs[$ref.split("/").at(-1) ?? ""];
  const name = definition?.properties?.name?.const;
  if (!name || !definition.properties) continue;
  const keys = eventProperties.get(name) ?? new Set<string>();
  Object.keys(definition.properties).forEach((key) => keys.add(key));
  eventProperties.set(name, keys);
}
const excludedEvents = new Set(["widget_seen", "widget_used", "widget_pinned", "widget_dismissed", "media_played", "media_paused", "media_seeked", "media_replayed"]);
const coreKinds = new Set(["casual", "coding", "writing", "analysis", "other"]);
const emptyIds = { has: () => false };
const noExcludedSessions: readonly string[] = [];
const inputStates = new WeakMap<Window, { current: "mouse" | "touch" | "pen" | "none" }>();
let posthogInitialized = false;
let posthogClient: Promise<typeof import("posthog-js").default> | undefined;

export function getInputType(pointer: string | undefined): "mouse" | "touch" | "pen" | "none" {
  return pointer === "fine" ? "mouse" : pointer === "coarse" ? "touch" : "none";
}

export function createValidatedCapture({ context, registry, send, ids, excludedSessionIds = [] }: {
  context: CaptureContextValue;
  registry: CaptureRegistry;
  send: (event: Event) => void;
  ids: { has: (type: AppIdType, id: string) => boolean };
  excludedSessionIds?: readonly string[];
}) {
  let inputType: { current: "mouse" | "touch" | "pen" | "none" } = { current: "none" };
  if (typeof window !== "undefined") {
    inputType = inputStates.get(window) ?? { current: getInputType(window.matchMedia("(pointer: fine)").matches ? "fine" : window.matchMedia("(pointer: coarse)").matches ? "coarse" : "none") };
    if (!inputStates.has(window)) {
      inputStates.set(window, inputType);
      window.addEventListener("pointerdown", (event) => { inputType.current = ["mouse", "touch", "pen"].includes(event.pointerType) ? event.pointerType as typeof inputType.current : "mouse"; }, { passive: true });
    }
  }
  return (fields: CapturedEvent) => {
    if (excludedSessionIds.includes(context.session_id) || excludedEvents.has(fields.name)) return false;
    const event = {
      ...roundSeconds(fields),
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      contracts_version: 1,
      session_id: context.session_id,
      ...(context.conversation_id ? { conversation_id: context.conversation_id } : {}),
      ...(context.kind ? { kind: context.kind } : {}),
      layout_version: context.layout_version,
      registry_version: registry.version,
      device_class: typeof window !== "undefined" && window.innerWidth < DEVICE_CLASS_BREAKPOINT ? "tablet" : "desktop",
      input_type: inputType.current,
    } as Event;
    if (!validateEvent(event) || !hasRegistryValues(event, registry, ids)) return false;
    send(event);
    return true;
  };
}

function hasRegistryValues(event: Event, registry: CaptureRegistry, ids: { has: (type: AppIdType, id: string) => boolean }) {
  if ("component" in event && event.component) {
    const entry = registry.entries.get(event.component);
    if (!entry) return false;
    if ("slot" in event && event.slot && !entry.meta.slots.includes(event.slot)) return false;
    if ("default_state" in event && !entry.meta.defaultStates.includes(event.default_state)) return false;
  }
  if ("command" in event && event.command) {
    const command = event.command;
    const isRegistryCommand = [...registry.entries.values()].some(({ meta }) => meta.commands.includes(command));
    if (!isRegistryCommand && !ids.has("command", command)) return false;
  }
  if ("kind" in event && typeof event.kind === "string" && !coreKinds.has(event.kind) && !ids.has("kind", event.kind)) return false;
  if ("proposal_id" in event && !ids.has("proposal", event.proposal_id)) return false;
  if ("decision_id" in event && !ids.has("decision", event.decision_id)) return false;
  return true;
}

export function CaptureProvider({ sink, children }: { sink: CaptureSink; children: ReactNode }) {
  return <CaptureContext.Provider value={sink}>{children}</CaptureContext.Provider>;
}

export function BrowserCaptureProvider({ children, registry, ids = emptyIds, excludedSessionIds = noExcludedSessions, temporary = false, lifecycle = true, layoutVersion = 1, conversationId, kind }: {
  children: ReactNode;
  registry: CaptureRegistry;
  ids?: { has: (type: AppIdType, id: string) => boolean };
  excludedSessionIds?: readonly string[];
  temporary?: boolean;
  lifecycle?: boolean;
  layoutVersion?: number;
  conversationId?: string;
  kind?: string;
}) {
  const sessionId = useMemo(() => {
    try {
      const storage = window.parent === window ? window.sessionStorage : window.parent.sessionStorage;
      const id = storage.getItem("implicity.session_id") ?? crypto.randomUUID();
      storage.setItem("implicity.session_id", id);
      return id;
    } catch {
      return crypto.randomUUID();
    }
  }, []);
  const sink = useMemo(() => temporary ? () => {} : createPostHogCapture({ session_id: sessionId, layout_version: layoutVersion, ...(conversationId ? { conversation_id: conversationId } : {}), ...(kind ? { kind } : {}) }, registry, ids, excludedSessionIds), [temporary, sessionId, layoutVersion, conversationId, kind, registry, ids, excludedSessionIds]);
  const sinkRef = useRef(sink);
  sinkRef.current = sink;
  useEffect(() => {
    if (temporary || !lifecycle) return;
    const now = new Date();
    const hour = now.getHours();
    const localHourBucket = hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const element = document.querySelector<HTMLElement>("[data-gallery-root]") ?? document.documentElement;
    const mode = element.dataset.mode === "dark" ? "dark" : "light";
    const textScale = Number(element.dataset.textSize || 3);
    sinkRef.current({ name: "session_started", mode, text_scale: textScale, local_hour_bucket: localHourBucket });
    const end = () => sinkRef.current({ name: "session_ended", mode, text_scale: textScale, local_hour_bucket: localHourBucket });
    window.addEventListener("pagehide", end, { once: true });
    return () => window.removeEventListener("pagehide", end);
  }, [sessionId, temporary, lifecycle]);
  return <CaptureProvider sink={sink}>{children}</CaptureProvider>;
}

export function useCaptureSink() { return useContext(CaptureContext); }

/** A skeleton passes the union of the event names it declares in events.ts. */
export function useCapture<Declared extends EventName>() {
  const sink = useContext(CaptureContext);
  return { emit<N extends Declared>(name: N, fields: Omit<CapturedEvent<N>, "name">) { sink({ ...fields, name } as unknown as CapturedEvent); } };
}

/** For tests: a sink that records every emitted event. */
export function recordingCapture() {
  const events: CapturedEvent[] = [];
  return { events, sink: (event: CapturedEvent) => void events.push(event) };
}

export const actionMeasurementRules = {
  seenVisibleRatio: SEEN_VISIBLE_RATIO,
  seenVisibleSeconds: SEEN_VISIBLE_SECONDS,
  deviceClassBreakpoint: DEVICE_CLASS_BREAKPOINT,
  secondsDecimalPlaces: SECONDS_DECIMAL_PLACES,
  meaningfulDraftCharacters: actions.meaningful_draft_characters,
  copyShare: "selected characters / source characters; under half is some, half or more is most, full copy is all",
  mediaType: "image/* => image; audio/* => audio; video/* => video; application/* or text/* => document; otherwise other",
} as const;

export function createPostHogCapture(context: CaptureContextValue, registry: CaptureRegistry, ids: { has: (type: AppIdType, id: string) => boolean }, excludedSessionIds: readonly string[] = []): CaptureSink {
  const apiKey = import.meta.env.VITE_POSTHOG_API_KEY;
  if (!apiKey) return () => {};
  posthogClient ??= import("posthog-js").then(({ default: client }) => {
    if (!posthogInitialized) {
      client.init(apiKey, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || "http://127.0.0.1:18000",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        persistence: "memory",
        before_send: sanitizePostHogEvent,
      });
      posthogInitialized = true;
    }
    return client;
  });
  return createValidatedCapture({ context, registry, ids, excludedSessionIds, send: (event) => { void posthogClient?.then((client) => client.capture(event.name, event as unknown as Record<string, unknown>)); } });
}

export function sanitizePostHogEvent<T extends { properties: Record<string, unknown> }>(event: T | null): T | null {
  if (!event) return null;
  const properties = event.properties;
  const allowed = typeof properties.name === "string" ? eventProperties.get(properties.name) : undefined;
  if (!allowed) return null;
  const sanitized = Object.fromEntries(Object.entries(properties).filter(([key]) => allowed.has(key)));
  if (!validateEvent(sanitized)) return null;
  event.properties = sanitized;
  return event;
}

function roundSeconds(fields: CapturedEvent): CapturedEvent {
  const rounded = { ...fields } as Record<string, unknown>;
  const precision = 10 ** SECONDS_DECIMAL_PLACES;
  for (const key of ["seconds_visible", "seconds_since_answer"]) {
    if (typeof rounded[key] === "number") rounded[key] = Math.round((rounded[key] as number) * precision) / precision;
  }
  return rounded as CapturedEvent;
}
