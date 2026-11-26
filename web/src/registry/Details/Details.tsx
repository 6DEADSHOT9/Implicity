import { useEffect, useId, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/ui/collapsible";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = { title: string; content: string; open: boolean; slots?: { details?: ReactNode[] }; onOpenChange?: (open: boolean) => void };
export function Details({ title, content, open, slots, onOpenChange }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const titleId = useId();
  const initialState = useRef(open ? "open" : "folded").current;
  const previous = useRef(open);
  const seenRef = useSeen({ component: "Details", defaultState: initialState, slot: "details" });

  useEffect(() => {
    emitRef.current("component_shown", { component: "Details", default_state: initialState, slot: "details" });
  }, [initialState]);
  useEffect(() => {
    if (previous.current === open) return;
    emitRef.current(open ? "section_expanded" : "section_collapsed", { component: "Details", slot: "details" });
    previous.current = open;
  }, [open]);

  return <Collapsible ref={seenRef} open={open} onOpenChange={onOpenChange} className="min-w-0 rounded-md token-border p-space-3">
    <CollapsibleTrigger asChild>
      <Button type="button" variant="ghost" className="h-auto min-h-control min-w-0 w-full justify-between whitespace-normal text-start">
        <span id={titleId} className="min-w-0 break-all">{title}</span><ChevronDown aria-hidden="true" className="size-icon shrink-0" />
      </Button>
    </CollapsibleTrigger>
    <CollapsibleContent role="region" aria-labelledby={titleId} className="min-w-0 break-words px-space-3 pb-space-3 text-sm">{slots?.details?.length ? slots.details : content}</CollapsibleContent>
  </Collapsible>;
}
