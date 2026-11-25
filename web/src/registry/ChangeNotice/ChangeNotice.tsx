import { useEffect, useId, useRef } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Marker } from "../../components/ui/marker";
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
  const toasterId = useId();
  const inlineRef = useRef<HTMLDivElement>(null);
  emitRef.current = emit;
  const actions = <div className="flex flex-wrap gap-space-2">
    <Button type="button" onClick={() => { emit("change_kept", { decision_id }); onKeep?.(); }}>Keep</Button>
    <Button type="button" variant="outline" onClick={() => { emit("change_undone", { decision_id }); onUndo?.(); }}>Undo</Button>
  </div>;
  const notice = <Alert role="status" aria-labelledby={titleId}>
    <AlertTitle><h2 style={{ fontSize: "var(--heading-4)" }} id={titleId}>{title}</h2></AlertTitle>
    <AlertDescription>{reason}</AlertDescription>
    <div className="col-start-2">{actions}</div>
  </Alert>;
  const noticeRef = useRef(notice);
  noticeRef.current = notice;

  useEffect(() => {
    emitRef.current("component_shown", { component: "ChangeNotice", default_state: presentation });
  }, [decision_id, presentation]);

  useEffect(() => {
    if (presentation !== "toast") return;
    const id = toast.custom(() => noticeRef.current, { duration: Infinity, toasterId });
    return () => { toast.dismiss(id); };
  }, [decision_id, onKeep, onUndo, presentation, reason, title, toasterId]);

  return presentation === "toast" ? <Toaster id={toasterId} position="top-right" duration={Infinity} theme={document.documentElement.dataset.mode === "dark" ? "dark" : "light"} style={{ fontFamily: "var(--font-body)", "--normal-bg": "var(--popover)", "--normal-text": "var(--popover-foreground)", "--normal-border": "var(--border)", "--border-radius": "var(--radius)", "--width": "var(--panel-width)" } as React.CSSProperties} /> : <div ref={inlineRef} role="status" aria-labelledby={titleId}><Marker label="Change" actions={actions}><div className="min-w-0"><h2 id={titleId} style={{ fontSize: "var(--heading-4)" }}>{title}</h2><p>{reason}</p></div></Marker></div>;
}
