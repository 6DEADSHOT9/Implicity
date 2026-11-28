import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import validateEvent from "../contracts/event-validator.js";
import schema from "../../../contracts/schemas/index.json" with { type: "json" };
import type { Event } from "../contracts/generated";
import type { SkeletonEntry } from "./define-skeleton";
import { deviceClass, SECONDS_DECIMAL_PLACES } from "./capture-rules";
import { createSessionHolder, safeSessionStore, watchSession } from "./capture-session";

type SharedField = "event_id" | "timestamp" | "contracts_version" | "session_id" | "conversation_id" | "kind" | "layout_version" | "registry_version" | "device_class" | "input_type";
export type EventName = Event["name"];
export type CapturedEvent<N extends EventName = EventName> = N extends EventName ? Omit<Extract<Event, { name: N }>, SharedField> : never;
export type CaptureSink = (event: CapturedEvent, producer?: string) => void;
export type AppIdType = "command" | "kind" | "proposal" | "decision";
export type CaptureRegistry = { version: number; entries: ReadonlyMap<string, { meta: Pick<SkeletonEntry["meta"], "slots" | "defaultStates" | "commands"> }> };
export type CaptureContextValue = Pick<Event, "session_id" | "layout_version"> & Pick<Partial<Event>, "conversation_id" | "kind">;

const CaptureContext = createContext<CaptureSink>(() => {});
const builtInValidator = validateEvent as (event: unknown) => boolean;
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
const inputStates = new WeakMap<Window, { current: "mouse" | "touch" | "pen" | "none" }>();
let posthogInitialized = false;
let posthogClient: Promise<typeof import("posthog-js").default> | undefined;

export function getInputType(pointer: string | undefined): "mouse" | "touch" | "pen" | "none" {
  return pointer === "fine" ? "mouse" : pointer === "coarse" ? "touch" : "none";
}

export function createValidatedCapture({ context: contextSource, registry, send, ids }: {
  /** The shared context, or a getter read when each event is stamped. */
  context: CaptureContextValue | (() => CaptureContextValue);
  registry: CaptureRegistry;
  send: (event: Event, producer?: string) => void;
  ids: { has: (type: AppIdType, id: string) => boolean };
}) {
  let inputType: { current: "mouse" | "touch" | "pen" | "none" } = { current: "none" };
  if (typeof window !== "undefined") {
    inputType = inputStates.get(window) ?? { current: getInputType(window.matchMedia("(pointer: fine)").matches ? "fine" : window.matchMedia("(pointer: coarse)").matches ? "coarse" : "none") };
    if (!inputStates.has(window)) {
      inputStates.set(window, inputType);
      window.addEventListener("pointerdown", (event) => { inputType.current = ["mouse", "touch", "pen"].includes(event.pointerType) ? event.pointerType as typeof inputType.current : "mouse"; }, { passive: true });
    }
  }
  return (fields: CapturedEvent, producer?: string) => {
    if (isExcludedEvent(fields.name)) return false;
    const context = typeof contextSource === "function" ? contextSource() : contextSource;
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
      device_class: typeof window !== "undefined" ? deviceClass(window.innerWidth) : "desktop",
      input_type: inputType.current,
    } as Event;
    if (!builtInValidator(event) || !hasRegistryValues(event, registry, ids, producer)) return false;
    send(event, producer);
    return true;
  };
}

export function isExcludedEvent(name: string) { return excludedEvents.has(name); }

function hasRegistryValues(event: Event, registry: CaptureRegistry, ids: { has: (type: AppIdType, id: string) => boolean }, producer?: string) {
  if ("component" in event && event.component) {
    const entry = registry.entries.get(event.component);
    if (!entry) return false;
    if ("slot" in event && event.slot && !entry.meta.slots.includes(event.slot)) return false;
    if ("default_state" in event && !entry.meta.defaultStates.includes(event.default_state)) return false;
  }
  if ("slot" in event && event.slot && !("component" in event && event.component)) return false;
  if ("command" in event && event.command) {
    const command = event.command;
    // A named component owns its Commands; ShortcutChips may carry any declared built-in.
    // A skeleton that names no component passes its own id as the producer. App code that
    // names neither may send any declared built-in. Workflow Commands are app-minted ids.
    const owner = ("component" in event ? event.component : undefined) ?? producer;
    const declared = owner === undefined || owner === "ShortcutChips"
      ? [...registry.entries.values()].some(({ meta }) => meta.commands.includes(command))
      : registry.entries.get(owner)?.meta.commands.includes(command) ?? false;
    if (!declared && !ids.has("command", command)) return false;
  }
  if ("kinds" in event && event.kinds.some((kind) => !coreKinds.has(kind) && !ids.has("kind", kind))) return false;
  if ("kind" in event && typeof event.kind === "string" && !coreKinds.has(event.kind) && !ids.has("kind", event.kind)) return false;
  if ("proposal_id" in event && !ids.has("proposal", event.proposal_id)) return false;
  if ("decision_id" in event && !ids.has("decision", event.decision_id)) return false;
  return true;
}

export function CaptureProvider({ sink, children }: { sink: CaptureSink; children: ReactNode }) {
  return <CaptureContext.Provider value={sink}>{children}</CaptureContext.Provider>;
}

export function BrowserCaptureProvider({ children, registry, ids = emptyIds, temporary = false, lifecycle = true, enabled = true, layoutVersion = 1, conversationId, kind }: {
  children: ReactNode;
  registry: CaptureRegistry;
  ids?: { has: (type: AppIdType, id: string) => boolean };
  temporary?: boolean;
  lifecycle?: boolean;
  enabled?: boolean;
  layoutVersion?: number;
  conversationId?: string;
  kind?: string;
}) {
  const active = enabled && !temporary;
  const captureRef = useRef<CaptureSink>(() => {});
  const [holder] = useState(() => createSessionHolder({ store: safeSessionStore(), emit: (event) => captureRef.current(event) }));
  const sink = useMemo<CaptureSink>(() => {
    if (!active) {
      captureRef.current = () => {};
      return () => {};
    }
    const capture = createPostHogCapture(() => ({ session_id: holder.id, layout_version: layoutVersion, ...(conversationId ? { conversation_id: conversationId } : {}), ...(kind ? { kind } : {}) }), registry, ids);
    captureRef.current = capture;
    return (event, producer) => {
      if (lifecycle && event.name !== "session_started" && event.name !== "session_ended") holder.ensureActive();
      capture(event, producer);
    };
  }, [active, lifecycle, holder, layoutVersion, conversationId, kind, registry, ids]);
  useEffect(() => {
    if (!active || !lifecycle) return;
    return watchSession(holder);
  }, [active, lifecycle, holder]);
  return <CaptureProvider sink={sink}>{children}</CaptureProvider>;
}

export function useCaptureSink() { return useContext(CaptureContext); }

/** A skeleton passes the union of the event names it declares in events.ts. */
export function useCapture<Declared extends EventName>(producer?: string) {
  const sink = useContext(CaptureContext);
  return { emit<N extends Declared>(name: N, fields: Omit<CapturedEvent<N>, "name">) { sink({ ...fields, name } as unknown as CapturedEvent, producer); } };
}

/** For tests: a sink that records every emitted event. */
export function recordingCapture() {
  const events: CapturedEvent[] = [];
  return { events, sink: (event: CapturedEvent) => void events.push(event) };
}

export function createPostHogCapture(context: CaptureContextValue | (() => CaptureContextValue), registry: CaptureRegistry, ids: { has: (type: AppIdType, id: string) => boolean }, config = { apiKey: import.meta.env.VITE_POSTHOG_API_KEY, apiHost: import.meta.env.VITE_POSTHOG_HOST || "http://127.0.0.1:18000" }): CaptureSink {
  const { apiKey, apiHost } = config;
  if (!apiKey) return () => {};
  posthogClient ??= import("posthog-js").then(({ default: client }) => {
    if (!posthogInitialized) {
      client.init(apiKey, postHogOptions(apiHost));
      posthogInitialized = true;
    }
    return client;
  });
  return createValidatedCapture({ context, registry, ids, send: (event) => { void posthogClient?.then((client) => client.capture(event.name, event as unknown as Record<string, unknown>, event.name === "session_ended" ? { send_instantly: true, transport: "sendBeacon" } : undefined)); } });
}

export function postHogOptions(apiHost: string) {
  return {
    api_host: apiHost,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    advanced_disable_flags: true,
    disable_external_dependency_loading: true,
    persistence: "memory" as const,
    request_batching: false,
    before_send: sanitizePostHogEvent,
  };
}

export function sanitizePostHogEvent<T extends { properties: Record<string, unknown> }>(event: T | null): T | null {
  if (!event) return null;
  const properties = event.properties;
  const allowed = typeof properties.name === "string" ? eventProperties.get(properties.name) : undefined;
  if (!allowed) return null;
  const sanitized = Object.fromEntries(Object.entries(properties).filter(([key]) => allowed.has(key)));
  if (!builtInValidator(sanitized)) return null;
  event.properties = { ...sanitized, ...Object.fromEntries(Object.entries(properties).filter(([key]) => key === "token" || key === "distinct_id")) };
  delete (event as T & { $set?: unknown }).$set;
  delete (event as T & { $set_once?: unknown }).$set_once;
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
