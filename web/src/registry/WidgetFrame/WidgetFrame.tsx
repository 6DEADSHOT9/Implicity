import { useEffect, useId, useRef } from "react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";
type Props = { title: string; lastUpdate: string; source: string; onDismiss?: () => void; slots?: { content?: React.ReactNode } };
export function WidgetFrame({ title, lastUpdate, source, onDismiss, slots }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit); emitRef.current = emit;
  const titleId = useId();
  const seenRef = useSeen({ component: "WidgetFrame", defaultState: "frame" });
  useEffect(() => { emitRef.current("component_shown", { component: "WidgetFrame", default_state: "frame" }); }, []);
  return <Card ref={seenRef} role="region" aria-labelledby={titleId} className="min-w-0 overflow-hidden"><CardHeader className="min-w-0"><CardTitle><h2 id={titleId} style={{fontSize:"var(--heading-4)"}} className="break-words break-all">{title}</h2></CardTitle><CardDescription className="break-words break-all">{lastUpdate} · {source}</CardDescription><CardAction><Button type="button" variant="ghost" onClick={onDismiss}>Dismiss</Button></CardAction></CardHeader><CardContent className="min-w-0 break-all">{slots?.content}</CardContent></Card>;
}
