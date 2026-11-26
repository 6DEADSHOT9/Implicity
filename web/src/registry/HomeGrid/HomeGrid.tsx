import { useEffect, useId, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";
type Props = { title: string; slots?: { widgets?: React.ReactNode } };
export function HomeGrid({ title, slots }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit); emitRef.current = emit;
  const titleId = useId();
  const seenRef = useSeen({ component: "HomeGrid", defaultState: "grid" });
  useEffect(() => { emitRef.current("component_shown", { component: "HomeGrid", default_state: "grid" }); }, []);
  return <Card ref={seenRef} role="region" aria-labelledby={titleId}><CardHeader><CardTitle><h1 id={titleId} style={{fontSize:"var(--heading-2)"}} className="break-words break-all">{title}</h1></CardTitle></CardHeader><CardContent className="grid min-w-0 grid-cols-1 gap-space-4 sm:grid-cols-2 lg:grid-cols-3">{slots?.widgets}</CardContent></Card>;
}
