import { useEffect, useId, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";
type Props = { title: string; progress: number; slots?: { content?: React.ReactNode } };
export function NowPlayingWidget({ title, progress, slots }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit); emitRef.current = emit;
  const titleId = useId();
  const seenRef = useSeen({ component: "NowPlayingWidget", defaultState: "now-playing" });
  useEffect(() => { emitRef.current("component_shown", { component: "NowPlayingWidget", default_state: "now-playing" }); }, []);
  return <Card ref={seenRef} role="region" aria-labelledby={titleId} className="min-w-0 overflow-hidden"><CardHeader><CardTitle><h2 id={titleId} style={{fontSize:"var(--heading-4)"}} className="break-words break-all">{title}</h2></CardTitle></CardHeader><CardContent className="min-w-0 break-all"><Progress aria-label="Playback progress" value={progress} max={100}/>{slots?.content}</CardContent></Card>;
}
