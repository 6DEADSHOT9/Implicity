import { useEffect, useRef, type ReactElement } from "react";
import { Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { Button } from "@/components/ui/button";
import { Empty, EmptyTitle } from "@/components/ui/empty";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

export function SourcesPanel({ docked, sources = [], onDockChange }: {
  docked: boolean;
  sources?: readonly { title: string; type: "web" | "document" | "other" }[];
  onDockChange?: (docked: boolean) => void;
}): ReactElement {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const defaultState = docked ? "docked" : "closed";
  const initialState = useRef(defaultState);
  const seenRef = useSeen({ component: "SourcesPanel", defaultState: initialState.current });
  const previousDocked = useRef(docked);
  useEffect(() => {
    emitRef.current("component_shown", { component: "SourcesPanel", default_state: initialState.current });
  }, []);
  useEffect(() => {
    if (previousDocked.current !== docked) emit(docked ? "panel_opened" : "panel_closed", { component: "SourcesPanel" });
    previousDocked.current = docked;
  }, [docked, emit]);
  return <section ref={seenRef} aria-label="Sources" className="flex flex-col gap-space-2 bg-card p-space-4 text-card-foreground">
    <h2 className="text-heading-3">Sources</h2>
    <Sources open={docked} onOpenChange={(next) => onDockChange?.(next)}>
      <SourcesTrigger asChild count={sources.length}>
        <Button variant="outline" className="w-fit bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground" style={{ minHeight: "var(--target-min-size)" }}>Sources ({sources.length})</Button>
      </SourcesTrigger>
      <SourcesContent>
        {sources.length ? <ul className="list-disc space-y-space-2 pl-space-4">
          {sources.map((source, index) => <li key={`${source.type}-${index}`}>
            <div className="flex flex-wrap items-center gap-space-2">
              <span>{source.title}</span>
              <span className="text-muted-foreground">{source.type}</span>
            </div>
          </li>)}
        </ul> : <Empty role="status"><EmptyTitle className="text-heading-4">No sources</EmptyTitle></Empty>}
      </SourcesContent>
    </Sources>
  </section>;
}
