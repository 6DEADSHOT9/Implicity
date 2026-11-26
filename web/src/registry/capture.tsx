import { createContext, useContext, type ReactNode } from "react";
import type { Event } from "../contracts/generated";

// Shared fields are added by the capture wrapper (T18), never by a skeleton.
type SharedField =
  | "event_id"
  | "timestamp"
  | "contracts_version"
  | "session_id"
  | "conversation_id"
  | "kind"
  | "layout_version"
  | "registry_version"
  | "device_class"
  | "input_type";

export type EventName = Event["name"];
export type CapturedEvent<N extends EventName = EventName> = N extends EventName
  ? Omit<Extract<Event, { name: N }>, SharedField>
  : never;
export type CaptureSink = (event: CapturedEvent) => void;

const CaptureContext = createContext<CaptureSink>(() => {});

export function CaptureProvider({ sink, children }: { sink: CaptureSink; children: ReactNode }) {
  return <CaptureContext.Provider value={sink}>{children}</CaptureContext.Provider>;
}

export function useCaptureSink() {
  return useContext(CaptureContext);
}

/** A skeleton passes the union of the event names it declares in events.ts. */
export function useCapture<Declared extends EventName>() {
  const sink = useContext(CaptureContext);
  return {
    emit<N extends Declared>(name: N, fields: Omit<CapturedEvent<N>, "name">) {
      sink({ ...fields, name } as unknown as CapturedEvent);
    },
  };
}

/** For tests: a sink that records every emitted event. */
export function recordingCapture() {
  const events: CapturedEvent[] = [];
  return { events, sink: (event: CapturedEvent) => void events.push(event) };
}
