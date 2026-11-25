import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Marker } from "../../components/ui/marker";
import { Toaster } from "../../components/ui/sonner";
import { useCapture } from "../capture";
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

function whenDisplayed(element: Element, callback: () => void) {
  const observer = new MutationObserver(check);
  let timer: ReturnType<typeof setTimeout>;
  function check() {
    if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return;
    clearTimeout(timer);
    observer.disconnect();
    callback();
  }
  for (let node: Element | null = element; node; node = node.parentElement) {
    observer.observe(node, { attributes: true, attributeFilter: ["class", "style", "hidden", "data-visible"] });
  }
  timer = setTimeout(check, 50);
  return () => { clearTimeout(timer); observer.disconnect(); };
}

function ToastNotice({ decision_id, title, reason, onKeep, onUndo }: Omit<Props, "presentation">) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const titleId = useId();
  const seenRef = useSeen({ component: "ChangeNotice", defaultState: "toast" });
  const [notice, setNotice] = useState<Element | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => { seenRef(node); setNotice(node); }, [seenRef]);

  useEffect(() => {
    if (!notice) return;
    return whenDisplayed(notice, () => {
      emitRef.current("component_shown", { component: "ChangeNotice", default_state: "toast" });
      emitRef.current("change_shown", { decision_id });
    });
  }, [decision_id, notice]);

  return <Alert ref={ref} className="box-border" role="status" aria-labelledby={titleId}>
    <AlertTitle><h2 style={{ fontSize: "var(--heading-4)" }} id={titleId}>{title}</h2></AlertTitle>
    <AlertDescription>{reason}</AlertDescription>
    <div className="col-start-2 flex flex-wrap gap-space-2">
      <Button type="button" onClick={() => { emit("change_kept", { decision_id }); onKeep?.(); }}>Keep</Button>
      <Button type="button" variant="outline" onClick={() => { emit("change_undone", { decision_id }); onUndo?.(); }}>Undo</Button>
    </div>
  </Alert>;
}

export function ChangeNoticeToastHost() {
  return <Toaster id="change-notices" position="top-right" duration={Infinity} expand theme={document.documentElement.dataset.mode === "dark" ? "dark" : "light"} style={{ fontFamily: "var(--font-body)", "--normal-bg": "var(--popover)", "--normal-text": "var(--popover-foreground)", "--normal-border": "var(--border)", "--border-radius": "var(--radius)", "--width": "var(--panel-width)" } as React.CSSProperties} />;
}

export function ChangeNotice({ decision_id, title, reason, presentation, onKeep, onUndo }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const titleId = useId();
  const seenRef = useSeen({ component: "ChangeNotice", defaultState: presentation });
  const [notice, setNotice] = useState<Element | null>(null);
  const noticeRef = useCallback((node: HTMLDivElement | null) => { seenRef(node); setNotice(node); }, [seenRef]);

  useEffect(() => {
    if (presentation !== "inline" || !notice) return;
    return whenDisplayed(notice, () => {
      emitRef.current("component_shown", { component: "ChangeNotice", default_state: "inline" });
      emitRef.current("change_shown", { decision_id });
    });
  }, [decision_id, notice, presentation]);

  useEffect(() => {
    if (presentation !== "toast") return;
    toast.custom(() => <ToastNotice decision_id={decision_id} title={title} reason={reason} onKeep={onKeep} onUndo={onUndo} />, { id: decision_id, duration: Infinity, toasterId: "change-notices" });
  }, [decision_id, onKeep, onUndo, presentation, reason, title]);

  useEffect(() => () => { if (presentation === "toast") toast.dismiss(decision_id); }, [decision_id, presentation]);

  if (presentation === "toast") return null;
  const actions = <div className="flex flex-wrap gap-space-2">
    <Button type="button" onClick={() => { emit("change_kept", { decision_id }); onKeep?.(); }}>Keep</Button>
    <Button type="button" variant="outline" onClick={() => { emit("change_undone", { decision_id }); onUndo?.(); }}>Undo</Button>
  </div>;
  return <div ref={noticeRef} role="status" aria-labelledby={titleId}><Marker label="Change" actions={actions}><div className="min-w-0"><h2 id={titleId} style={{ fontSize: "var(--heading-4)" }}>{title}</h2><p>{reason}</p></div></Marker></div>;
}
