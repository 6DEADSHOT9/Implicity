import { useEffect, useId, useRef } from "react";
import { Check, Circle, LoaderCircle, TriangleAlert } from "lucide-react";
import { TaskItem } from "../../components/ai-elements/task";
import { Tool, ToolContent, ToolHeader } from "../../components/ai-elements/tool";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Step = { label: string; status: "pending" | "running" | "complete" | "error" };
type ToolStatus = "input-streaming" | "input-available" | "output-available" | "output-error";

export function RunActivity({ title, steps, open, onOpenChange }: { title: string; steps: readonly Step[]; open: boolean; onOpenChange?: (open: boolean) => void }) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const titleId = useId();
  const initialState = useRef(open ? "open" : "folded").current;
  const previous = useRef(open);
  const seenRef = useSeen({ component: "RunActivity", defaultState: initialState, slot: "steps" });
  const status: ToolStatus = steps.some(({ status }) => status === "error") ? "output-error"
    : steps.some(({ status }) => status === "running") ? "input-available"
      : steps.every(({ status }) => status === "complete") ? "output-available" : "input-streaming";

  useEffect(() => {
    emitRef.current("component_shown", { component: "RunActivity", default_state: initialState, slot: "steps" });
  }, [initialState]);
  useEffect(() => {
    if (previous.current === open) return;
    emitRef.current(open ? "section_expanded" : "section_collapsed", { component: "RunActivity", slot: "steps" });
    previous.current = open;
  }, [open]);

  return <Tool ref={seenRef} open={open} onOpenChange={onOpenChange} className="box-border min-w-0 max-w-full">
    <div id={titleId} className="min-w-0"><ToolHeader type="dynamic-tool" toolName="activity" title={title} state={status} className="min-w-0 flex-wrap whitespace-normal break-all [&>div]:min-w-0 [&>div]:flex-1 [&>div]:flex-wrap [&_span]:min-w-0 [&_span]:whitespace-normal [&_span]:break-all" /></div>
    <ToolContent role="region" aria-labelledby={titleId} className="min-w-0 max-w-full overflow-hidden">
      <ol className="flex min-w-0 flex-col gap-space-2">
        {steps.map(({ label, status: stepStatus }, index) => {
          const Icon = stepStatus === "complete" ? Check : stepStatus === "running" ? LoaderCircle : stepStatus === "error" ? TriangleAlert : Circle;
          return <li key={`${label}-${index}`}>
            <TaskItem className="flex min-w-0 flex-wrap items-start gap-space-2">
              <Icon aria-hidden="true" className="size-icon shrink-0" />
              <span className="min-w-0 flex-1 break-all">{label}</span>
              <span className="shrink-0 text-muted-foreground">· {stepStatus}</span>
            </TaskItem>
          </li>;
        })}
      </ol>
    </ToolContent>
  </Tool>;
}
