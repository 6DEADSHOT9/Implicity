import { useEffect, useId, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { useCapture } from "../capture";
import { useSeen } from "../use-seen";
import { events } from "./events";

type Props = {
  title: string;
  message: string;
  actionLabel: string;
  onAction?: () => void;
  onLater?: () => void;
};

export function Nudge({ title, message, actionLabel, onAction, onLater }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const titleId = useId();
  const seenRef = useSeen({ component: "Nudge", defaultState: "prompt" });
  emitRef.current = emit;
  useEffect(() => {
    emitRef.current("component_shown", { component: "Nudge", default_state: "prompt" });
  }, []);

  return <Alert ref={seenRef} role="status" aria-labelledby={titleId}>
    <AlertTitle><h2 style={{ fontSize: "var(--heading-4)" }} id={titleId}>{title}</h2></AlertTitle>
    <AlertDescription>{message}</AlertDescription>
    <div className="col-start-2 flex flex-wrap gap-space-2">
      <Button type="button" onClick={onAction}>{actionLabel}</Button>
      <Button type="button" variant="outline" onClick={onLater}>Later</Button>
    </div>
  </Alert>;
}
