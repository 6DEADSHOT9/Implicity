import { useEffect, useId, useRef } from "react";
import { Check, Circle, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/ui/collapsible";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Step = { label: string; status: "pending" | "running" | "complete" | "error" };
export function RunActivity({ title, steps, open, onOpenChange }: { title: string; steps: readonly Step[]; open: boolean; onOpenChange?: (open: boolean) => void }) {
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit; const titleId = useId();
  const seenRef = useSeen({ component: "RunActivity", defaultState: open ? "open" : "closed" });
  useEffect(() => { emitRef.current("component_shown", { component: "RunActivity", default_state: open ? "open" : "closed" }); }, []);
  return <Collapsible ref={seenRef} open={open} onOpenChange={onOpenChange} className="min-w-0 rounded-md border-token p-space-3"><CollapsibleTrigger asChild><Button type="button" variant="ghost" className="h-auto min-h-control w-full justify-between whitespace-normal text-start"><span id={titleId} className="break-words">{title} <span className="text-muted-foreground">{steps.filter(({ status }) => status === "complete").length}/{steps.length}</span></span></Button></CollapsibleTrigger><CollapsibleContent aria-labelledby={titleId}><ol className="flex min-w-0 flex-col gap-space-2 px-space-3 py-space-2">{steps.map(({ label, status }, index) => { const Icon = status === "complete" ? Check : status === "running" ? LoaderCircle : status === "error" ? TriangleAlert : Circle; return <li key={`${label}-${index}`} className="flex min-w-0 items-start gap-space-2 break-words"><Icon aria-hidden="true" className="size-icon shrink-0" /><span>{label}</span><span className="visually-hidden">{status}</span></li>; })}</ol></CollapsibleContent></Collapsible>;
}
