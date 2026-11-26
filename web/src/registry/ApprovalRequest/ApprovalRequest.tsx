import { useEffect, useId, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type State = "pending" | "approved" | "denied";
export function ApprovalRequest({ title, detail, state, onApprove, onEdit, onDeny }: { title: string; detail: string; state: State; onApprove?: () => void; onEdit?: () => void; onDeny?: () => void }) {
  const { emit } = useCapture<(typeof events)[number]>(); const emitRef = useRef(emit); emitRef.current = emit; const titleId = useId();
  const seenRef = useSeen({ component: "ApprovalRequest", defaultState: state });
  useEffect(() => { emitRef.current("component_shown", { component: "ApprovalRequest", default_state: state }); }, []);
  return <Alert ref={seenRef} role="region" aria-labelledby={titleId} className="min-w-0"><AlertTitle><h2 id={titleId} className="break-words text-heading-4">{title}</h2></AlertTitle><AlertDescription className="break-words">{detail}</AlertDescription>{state === "pending" && <div className="flex flex-wrap gap-space-2"><Button type="button" className="min-h-control" onClick={onApprove}>Approve</Button><Button type="button" variant="outline" className="min-h-control" onClick={onEdit}>Edit</Button><Button type="button" variant="outline" className="min-h-control" onClick={onDeny}>Deny</Button></div>}</Alert>;
}
