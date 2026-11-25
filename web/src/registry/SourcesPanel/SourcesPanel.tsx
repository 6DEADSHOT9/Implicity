import { useEffect, useRef, type ReactElement } from "react";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { Empty, EmptyTitle } from "@/components/ui/empty";
import { useCapture } from "../capture";
import { events } from "./events";

export function SourcesPanel({ sources, onOpenChange }: {
  sources: readonly { title: string; type: "web" | "document" | "other" }[];
  onOpenChange?: (open: boolean) => void;
}): ReactElement {
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
  return <section aria-label="Sources" className="flex flex-col gap-space-2 bg-card p-space-4 text-card-foreground">
    <h2 className="text-heading-3">Sources</h2>
    <Sources defaultOpen onOpenChange={(open) => {
      emit(open ? "panel_opened" : "panel_closed", { component: "SourcesPanel" });
      onOpenChange?.(open);
    }}>
      <SourcesTrigger count={sources.length}>Sources ({sources.length})</SourcesTrigger>
      <SourcesContent>
        {sources.length ? <ul className="list-disc space-y-space-2 pl-space-4">
          {sources.map((source, index) => <li key={`${source.type}-${index}`} className="flex flex-wrap items-center gap-space-2">
            <Source title={source.title} />
            <span className="text-muted-foreground">{source.type}</span>
          </li>)}
        </ul> : <Empty role="status"><EmptyTitle className="text-heading-4">No sources</EmptyTitle></Empty>}
      </SourcesContent>
    </Sources>
  </section>;
}
