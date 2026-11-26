import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { InlineCitation, InlineCitationText } from "../../components/ai-elements/inline-citation";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = { label: string; source: string; source_type: "web" | "memory"; onOpenMemory?: (memoryId: string) => void };
export function Citation({ label, source, source_type, onOpenMemory }: Props) {
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit;
  const initialState = useRef(source_type).current;
  const seenRef = useSeen({ component: "Citation", defaultState: initialState });
  useEffect(() => { emitRef.current("component_shown", { component: "Citation", default_state: initialState }); }, [initialState]);
  const content = <InlineCitationText className="min-w-0 whitespace-normal break-all">{label}</InlineCitationText>;
  return <span ref={seenRef}><InlineCitation>{source_type === "web"
    ? <a href={source} target="_blank" rel="noreferrer" className="inline-flex min-h-control max-w-full items-center rounded-full border-token bg-secondary px-space-3 py-space-2">{content}</a>
    : <Button type="button" variant="outline" className="min-h-control max-w-full whitespace-normal break-all" onClick={() => onOpenMemory?.(source)}>{content}</Button>}</InlineCitation></span>;
}
