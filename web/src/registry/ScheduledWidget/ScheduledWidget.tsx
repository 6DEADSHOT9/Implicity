import { useEffect, useId, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";
type Props = { title: string; slots?: { content?: React.ReactNode } };
export function ScheduledWidget({ title, slots }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit); emitRef.current = emit;
  const titleId = useId();
  const seenRef = useSeen({ component: "ScheduledWidget", defaultState: "scheduled" });
  useEffect(() => { emitRef.current("component_shown", { component: "ScheduledWidget", default_state: "scheduled" }); }, []);
  return <Card ref={seenRef} role="region" aria-labelledby={titleId} className="min-w-0 overflow-hidden"><CardHeader><CardTitle><h2 id={titleId} style={{fontSize:"var(--heading-4)"}} className="break-words break-all">{title}</h2></CardTitle></CardHeader><CardContent className="min-w-0 break-all">{slots?.content}</CardContent></Card>;
}
