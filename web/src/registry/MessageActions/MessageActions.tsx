import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "../../components/ui/button";
import { ButtonGroup } from "../../components/ui/button-group";
import { Pagination, PaginationContent, PaginationItem } from "../../components/ui/pagination";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Form = "prose" | "list" | "table";
type Props = {
  answer_form: Form;
  version_index: number;
  version_count: number;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onFeedback?: (feedback: "positive" | "negative") => void;
  onVersionChange?: (version: number) => void;
  onRemember?: () => void;
  onAnswerFormChange?: (form: Form) => void;
};

export function MessageActions({ answer_form, version_index, version_count, onCopy, onRegenerate, onFeedback, onVersionChange, onRemember, onAnswerFormChange }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const initialState = useRef(answer_form).current;
  const previous = useRef(answer_form);
  const seenRef = useSeen({ component: "MessageActions", defaultState: initialState });

  useEffect(() => {
    emitRef.current("component_shown", { component: "MessageActions", default_state: initialState });
  }, []);
  useEffect(() => {
    if (previous.current === answer_form) return;
    emitRef.current("representation_switched", { dimension: "answer_form", from: previous.current, to: answer_form });
    previous.current = answer_form;
  }, [answer_form]);

  return <div ref={seenRef} role="group" aria-label="Message actions" className="flex min-w-0 max-w-full flex-wrap items-center gap-space-2">
    <ButtonGroup className="flex-wrap">
      <Button type="button" variant="outline" className="min-h-control" onClick={onCopy}>Copy</Button>
      <Button type="button" variant="outline" className="min-h-control" onClick={onRegenerate}>Regenerate</Button>
      <TooltipProvider>
        <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" className="min-h-control" aria-label="Helpful" onClick={() => onFeedback?.("positive")}><ThumbsUp aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>Helpful</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" className="min-h-control" aria-label="Not helpful" onClick={() => onFeedback?.("negative")}><ThumbsDown aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>Not helpful</TooltipContent></Tooltip>
      </TooltipProvider>
      <Button type="button" variant="outline" className="min-h-control" onClick={onRemember}>Remember this</Button>
    </ButtonGroup>
    <Pagination className="mx-0 w-auto" aria-label="Answer versions">
      <PaginationContent>
        <PaginationItem><Button type="button" size="icon" variant="ghost" className="min-h-control" aria-label="Previous version" disabled={version_index <= 1} onClick={() => onVersionChange?.(version_index - 1)}><ChevronLeft aria-hidden="true" /></Button></PaginationItem>
        <PaginationItem><span aria-live="polite" className="whitespace-nowrap px-space-2 text-sm">Version {version_index} of {version_count}</span></PaginationItem>
        <PaginationItem><Button type="button" size="icon" variant="ghost" className="min-h-control" aria-label="Next version" disabled={version_index >= version_count} onClick={() => onVersionChange?.(version_index + 1)}><ChevronRight aria-hidden="true" /></Button></PaginationItem>
      </PaginationContent>
    </Pagination>
    {(["prose", "list", "table"] as const).map((form) => <Button key={form} type="button" size="sm" className="min-h-control" variant={answer_form === form ? "secondary" : "ghost"} aria-pressed={answer_form === form} onClick={() => onAnswerFormChange?.(form)}>{form[0].toUpperCase() + form.slice(1)}</Button>)}
  </div>;
}
