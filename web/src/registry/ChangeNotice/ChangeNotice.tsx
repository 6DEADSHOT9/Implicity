import { useEffect, useId, useRef } from "react";
import { toast } from "sonner";
import { CaptureProvider, useCapture, useCaptureSink } from "../capture";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Marker } from "../../components/ui/marker";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = {
  decision_id: string;
  title: string;
  reason: string;
  presentation: "inline" | "toast";
  onKeep?: () => void;
  onUndo?: () => void;
};

function ToastNotice({ decision_id, title, reason, onKeep, onUndo }: Omit<Props, "presentation">) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const titleId = useId();
  const shownRef = useRef(false);
  const seenRef = useSeen({ component: "ChangeNotice", defaultState: "toast", onVisible: () => {
    shownRef.current = true;
    emitRef.current("component_shown", { component: "ChangeNotice", default_state: "toast" });
    emitRef.current("change_shown", { decision_id });
  } });

  return <Alert ref={seenRef} role="status" aria-labelledby={titleId}>
    <AlertTitle><h2 style={{ fontSize: "var(--heading-4)" }} id={titleId}>{title}</h2></AlertTitle>
    <AlertDescription>{reason}</AlertDescription>
    <div className="col-start-2 flex flex-wrap gap-space-2">
      <Button type="button" onClick={() => { if (!shownRef.current && !seenRef.reportVisible()) return; emit("change_kept", { decision_id }); onKeep?.(); }}>Keep</Button>
      <Button type="button" variant="outline" onClick={() => { if (!shownRef.current && !seenRef.reportVisible()) return; emit("change_undone", { decision_id }); onUndo?.(); }}>Undo</Button>
    </div>
  </Alert>;
}

function InlineNotice({ decision_id, title, reason, onKeep, onUndo }: Omit<Props, "presentation">) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const titleId = useId();
  const shownRef = useRef(false);
  const seenRef = useSeen({ component: "ChangeNotice", defaultState: "inline", onVisible: () => {
    shownRef.current = true;
    emitRef.current("component_shown", { component: "ChangeNotice", default_state: "inline" });
    emitRef.current("change_shown", { decision_id });
  } });
  const actions = <div className="flex flex-wrap gap-space-2">
    <Button type="button" onClick={() => { if (!shownRef.current && !seenRef.reportVisible()) return; emit("change_kept", { decision_id }); onKeep?.(); }}>Keep</Button>
    <Button type="button" variant="outline" onClick={() => { if (!shownRef.current && !seenRef.reportVisible()) return; emit("change_undone", { decision_id }); onUndo?.(); }}>Undo</Button>
  </div>;
  return <div ref={seenRef} role="status" aria-labelledby={titleId}><Marker label="Change" actions={actions}><div className="min-w-0"><h2 id={titleId} style={{ fontSize: "var(--heading-4)" }}>{title}</h2><p>{reason}</p></div></Marker></div>;
}

export function ChangeNotice({ decision_id, title, reason, presentation, onKeep, onUndo }: Props) {
  const sink = useCaptureSink();
  useEffect(() => {
    if (presentation !== "toast") return;
    toast.custom(() => <CaptureProvider sink={sink}><ToastNotice decision_id={decision_id} title={title} reason={reason} onKeep={onKeep} onUndo={onUndo} /></CaptureProvider>, { id: decision_id, duration: Infinity, toasterId: "change-notices" });
  }, [decision_id, onKeep, onUndo, presentation, reason, sink, title]);
  useEffect(() => () => { if (presentation === "toast") toast.dismiss(decision_id); }, [decision_id, presentation]);
  return presentation === "toast" ? null : <InlineNotice key={decision_id} decision_id={decision_id} title={title} reason={reason} onKeep={onKeep} onUndo={onUndo} />;
}
