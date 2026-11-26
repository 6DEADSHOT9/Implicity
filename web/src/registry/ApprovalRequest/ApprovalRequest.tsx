import { useEffect, useId, useRef } from "react";
import { AlertDescription } from "../../components/ui/alert";
import { Confirmation, ConfirmationAccepted, ConfirmationAction, ConfirmationActions, ConfirmationRejected } from "../../components/ai-elements/confirmation";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type State = "pending" | "approved" | "denied";
export function ApprovalRequest({ title, detail, state, onApprove, onEdit, onDeny }: { title: string; detail: string; state: State; onApprove?: () => void; onEdit?: () => void; onDeny?: () => void }) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const titleId = useId();
  const initialState = useRef(state).current;
  const seenRef = useSeen({ component: "ApprovalRequest", defaultState: initialState });
  const approval = state === "pending" ? { id: "approval" } : { id: "approval", approved: state === "approved" };
  const confirmationState = state === "pending" ? "approval-requested" : "approval-responded";

  useEffect(() => {
    emitRef.current("component_shown", { component: "ApprovalRequest", default_state: initialState });
  }, [initialState]);

  return <Confirmation ref={seenRef} role="region" aria-labelledby={titleId} approval={approval} state={confirmationState} className="min-w-0 max-w-full">
    <div className="col-start-2 min-w-0 whitespace-normal break-all"><h2 id={titleId} style={{ fontSize: "var(--heading-4)" }}>{title}</h2></div>
    <AlertDescription className="col-start-2 min-w-0 whitespace-normal break-all">{detail}</AlertDescription>
    {state === "pending" && <ConfirmationActions className="col-start-2 flex w-full flex-wrap justify-start">
      <ConfirmationAction className="min-w-0 whitespace-normal" onClick={onApprove}>Approve</ConfirmationAction>
      <ConfirmationAction variant="outline" className="min-w-0 whitespace-normal" onClick={onEdit}>Edit</ConfirmationAction>
      <ConfirmationAction variant="outline" className="min-w-0 whitespace-normal" onClick={onDeny}>Deny</ConfirmationAction>
    </ConfirmationActions>}
    <ConfirmationAccepted><AlertDescription className="col-start-2">Approved</AlertDescription></ConfirmationAccepted>
    <ConfirmationRejected><AlertDescription className="col-start-2">Denied</AlertDescription></ConfirmationRejected>
  </Confirmation>;
}
