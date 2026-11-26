import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { Marker } from "../../components/ui/marker";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

const labels = { remembered: "Remembered", noticed: "Noticed", set: "Set" } as const;

export function ContextChip({ detail, kind, onCorrect }: { detail: string; kind: keyof typeof labels; onCorrect?: () => void }) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const initialState = useRef(kind).current;
  const seenRef = useSeen({ component: "ContextChip", defaultState: initialState });
  useEffect(() => {
    emitRef.current("component_shown", { component: "ContextChip", default_state: initialState });
  }, [initialState]);
  return <div ref={seenRef} className="min-w-0 max-w-full">
    <Marker label={labels[kind]} actions={<Button type="button" variant="outline" className="min-h-control" onClick={onCorrect}>Correct</Button>}>
      <div className="min-w-0 flex-1"><p className="min-w-0 whitespace-normal break-all">{detail}</p></div>
    </Marker>
  </div>;
}
