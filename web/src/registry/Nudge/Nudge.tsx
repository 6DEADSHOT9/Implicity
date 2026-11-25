import { useEffect, useId, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { useCapture } from "../capture";
import { events } from "./events";

type Props = {
  title: string;
  message: string;
  actionLabel: string;
  onAction?: () => void;
  onLater?: () => void;
};

export function Nudge({ title, message, actionLabel, onAction, onLater }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  emitRef.current = emit;
  useEffect(() => {
    emitRef.current("component_shown", { component: "Nudge", default_state: "prompt" });
    let timer: number | undefined;
    let seen = false;
    const reportSeen = () => {
      if (seen) return;
      seen = true;
      emitRef.current("component_seen", { component: "Nudge", default_state: "prompt", seconds_visible: 3 });
    };
    const observer = rootRef.current && "IntersectionObserver" in window ? new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && timer === undefined && !seen) timer = window.setTimeout(reportSeen, 3000);
      else if (!entry.isIntersecting && timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    }) : undefined;
    if (observer) observer.observe(rootRef.current!);
    else timer = window.setTimeout(reportSeen, 3000);
    return () => { observer?.disconnect(); if (timer !== undefined) window.clearTimeout(timer); };
  }, []);

  return <Alert ref={rootRef} className="grid-cols-1" role="status" aria-labelledby={titleId}>
    <AlertTitle className="col-start-1"><h2 style={{ fontSize: "var(--heading-4)" }} id={titleId}>{title}</h2></AlertTitle>
    <AlertDescription className="col-start-1">{message}</AlertDescription>
    <div className="col-start-1 flex flex-wrap gap-space-2">
      <Button onClick={onAction}>{actionLabel}</Button>
      <Button variant="outline" onClick={onLater}>Later</Button>
    </div>
  </Alert>;
}
