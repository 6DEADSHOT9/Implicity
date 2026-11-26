import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { Marker } from "../../components/ui/marker";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

export function ContextChip({ label, detail, kind, onCorrect }: { label: string; detail: string; kind: "remembered" | "noticed" | "set"; onCorrect?: () => void }) {
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit;
  const seenRef = useSeen({ component: "ContextChip", defaultState: kind });
  useEffect(() => { emitRef.current("component_shown", { component: "ContextChip", default_state: kind }); }, []);
  return <div ref={seenRef}><Marker label={label} actions={<Button type="button" variant="outline" className="min-h-control" onClick={onCorrect}>Correct</Button>}><p className="min-w-0 break-words">{detail}</p></Marker></div>;
}
