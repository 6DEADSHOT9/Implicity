import { useEffect, useRef, type ReactElement } from "react";
import { token } from "../token";
import { useCapture } from "../capture";
import { events } from "./events";

export function SourcesPanel({ sources }: { sources: readonly { title: string; type: "web" | "document" | "other" }[] }): ReactElement {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const defaultState = sources.length ? "populated" : "empty";
  const initialState = useRef(defaultState);
  useEffect(() => {
    emitRef.current("component_shown", { component: "SourcesPanel", default_state: initialState.current });
    const timer = window.setTimeout(() => emitRef.current("component_seen", { component: "SourcesPanel", default_state: initialState.current, seconds_visible: 3 }), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  return <section aria-labelledby="sources-heading" className="flex flex-col gap-3 rounded-md bg-card p-4 text-card-foreground">
    <h2 id="sources-heading">Sources</h2>
    {sources.length ? <ul className="flex flex-col gap-2">{sources.map((source, index) => <li key={`${source.type}-${index}`} className="flex items-center gap-3 rounded-sm p-3" style={{ minHeight: token("--target-min-size") }}>
      <span>{source.title}</span><span>{source.type}</span>
    </li>)}</ul> : <p role="status">No sources</p>}
  </section>;
}
