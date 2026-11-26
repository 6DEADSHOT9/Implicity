import { useEffect, useId, useRef } from "react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";
type Props = { open: boolean; title: string; onOpenChange?: (open: boolean) => void; slots?: { widgets?: React.ReactNode } };
export function WidgetPicker({ open, title, onOpenChange, slots }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit); emitRef.current = emit;
  const titleId = useId();
  const seenRef = useSeen({ component: "WidgetPicker", defaultState: "closed" });
  const previousOpen = useRef(open);
  useEffect(() => { if (previousOpen.current !== open) { emitRef.current(open ? "panel_opened" : "panel_closed", { component: "WidgetPicker" }); previousOpen.current = open; } }, [open]);
  useEffect(() => { emitRef.current("component_shown", { component: "WidgetPicker", default_state: "closed" }); }, []);
  return <div ref={seenRef} className="flex flex-wrap items-center gap-space-2"><Button type="button" onClick={() => onOpenChange?.(true)}>Customize Home</Button><Dialog open={open} onOpenChange={onOpenChange}><DialogContent aria-labelledby={titleId}><DialogHeader><DialogTitle id={titleId} style={{ fontSize: "var(--heading-4)" }} className="break-words break-all">{title}</DialogTitle><DialogDescription>Choose which widgets appear on Home.</DialogDescription></DialogHeader><div className="min-w-0 break-all">{slots?.widgets}</div></DialogContent></Dialog></div>;
}
