import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { ButtonGroup } from "../../components/ui/button-group";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Form = "prose" | "list" | "table";
export function MessageActions({ answer_form, onCopy, onRegenerate, onRemember, onAnswerFormChange }: { answer_form: Form; onCopy?: () => void; onRegenerate?: () => void; onRemember?: () => void; onAnswerFormChange?: (form: Form) => void }) {
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit; const previous = useRef(answer_form);
  const seenRef = useSeen({ component: "MessageActions", defaultState: answer_form });
  useEffect(() => { emitRef.current("component_shown", { component: "MessageActions", default_state: answer_form }); }, []);
  useEffect(() => { if (previous.current !== answer_form) { emitRef.current("representation_switched", { dimension: "answer_form", from: previous.current, to: answer_form }); previous.current = answer_form; } }, [answer_form]);
  return <div ref={seenRef} role="group" aria-label="Message actions" className="flex min-w-0 flex-wrap items-center gap-space-2"><ButtonGroup><Button type="button" variant="outline" className="min-h-control" onClick={onCopy}>Copy</Button><Button type="button" variant="outline" className="min-h-control" onClick={onRegenerate}>Regenerate</Button><Button type="button" variant="outline" className="min-h-control" onClick={onRemember}>Remember</Button></ButtonGroup>{(["prose", "list", "table"] as const).map((form) => <Button key={form} type="button" size="sm" className="min-h-control" variant={answer_form === form ? "secondary" : "ghost"} aria-pressed={answer_form === form} onClick={() => onAnswerFormChange?.(form)}>{form}</Button>)}</div>;
}
