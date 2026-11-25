import { useEffect, useId, useRef } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Toaster } from "../../components/ui/sonner";
import { useCapture } from "../capture";
import { events } from "./events";

type Props = {
  decision_id: string;
  title: string;
  reason: string;
  presentation: "inline" | "toast";
  onKeep?: () => void;
  onUndo?: () => void;
};

export function ChangeNotice({ decision_id, title, reason, presentation, onKeep, onUndo }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const titleId = useId();
  const inlineRef = useRef<HTMLDivElement>(null);
  emitRef.current = emit;
  const notice = <Alert className="grid-cols-1" role="status" aria-labelledby={titleId}>
    <AlertTitle className="col-start-1"><h2 style={{ fontSize: "var(--heading-4)" }} id={titleId}>{title}</h2></AlertTitle>
    <AlertDescription className="col-start-1">{reason}</AlertDescription>
    <div className="col-start-1 flex flex-wrap gap-space-2">
      <Button onClick={() => { emit("change_kept", { decision_id }); onKeep?.(); }}>Keep</Button>
      <Button variant="outline" onClick={() => { emit("change_undone", { decision_id }); onUndo?.(); }}>Undo</Button>
    </div>
  </Alert>;
  const noticeRef = useRef(notice);
  noticeRef.current = notice;

  useEffect(() => {
    emitRef.current("component_shown", { component: "ChangeNotice", default_state: presentation });
    if (presentation === "toast") {
      let timer: number | undefined;
      const id = toast.custom(() => noticeRef.current, {
        duration: Infinity,
        onDismiss: () => { if (timer !== undefined) window.clearTimeout(timer); },
      });
      timer = window.setTimeout(() => emitRef.current("component_seen", { component: "ChangeNotice", default_state: presentation, seconds_visible: 3 }), 3000);
      return () => { if (timer !== undefined) window.clearTimeout(timer); toast.dismiss(id); };
    }
    let timer: number | undefined;
    let seen = false;
    const reportSeen = () => {
      if (seen) return;
      seen = true;
      emitRef.current("component_seen", { component: "ChangeNotice", default_state: presentation, seconds_visible: 3 });
    };
    const observer = inlineRef.current && "IntersectionObserver" in window ? new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && timer === undefined && !seen) timer = window.setTimeout(reportSeen, 3000);
      else if (!entry.isIntersecting && timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    }) : undefined;
    if (observer) observer.observe(inlineRef.current!);
    else timer = window.setTimeout(reportSeen, 3000);
    return () => { observer?.disconnect(); if (timer !== undefined) window.clearTimeout(timer); };
  }, [decision_id, presentation]);

  return presentation === "toast" ? <Toaster duration={Infinity} style={{ fontFamily: "var(--font-body)" }} /> : <div ref={inlineRef}>{notice}</div>;
}
