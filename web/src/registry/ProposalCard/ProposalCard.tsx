import { useEffect, useId, useRef } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { useCapture } from "../capture";
import { events } from "./events";

type ProposalType = "look" | "widget" | "workflow" | "kind" | "schedule" | "dimension";
type Props = {
  proposal_id: string;
  proposal_type: ProposalType;
  title: string;
  description: string;
  preview?: string;
  onKeep?: () => void;
  onDismiss?: () => void;
};

export function ProposalCard({ proposal_id, proposal_type, title, description, preview, onKeep, onDismiss }: Props) {
  const { emit } = useCapture<(typeof events)[number]>();
  const emitRef = useRef(emit);
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  emitRef.current = emit;
  useEffect(() => {
    emitRef.current("component_shown", { component: "ProposalCard", default_state: "preview" });
    emitRef.current("proposal_shown", { proposal_id, proposal_type });
    let timer: number | undefined;
    let seen = false;
    const reportSeen = () => {
      if (seen) return;
      seen = true;
      emitRef.current("component_seen", { component: "ProposalCard", default_state: "preview", seconds_visible: 3 });
    };
    const observer = rootRef.current && "IntersectionObserver" in window ? new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && timer === undefined && !seen) timer = window.setTimeout(reportSeen, 3000);
      else if (!entry.isIntersecting && timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    }) : undefined;
    if (observer) observer.observe(rootRef.current!);
    else timer = window.setTimeout(reportSeen, 3000);
    return () => { observer?.disconnect(); if (timer !== undefined) window.clearTimeout(timer); };
  }, [proposal_id, proposal_type]);

  return <Card ref={rootRef} role="region" aria-labelledby={titleId}>
    <CardHeader>
      <CardTitle><h2 style={{ fontSize: "var(--heading-4)" }} id={titleId}>{title}</h2></CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    {preview && <CardContent><div className="rounded-md bg-muted p-space-4" role="group" aria-label="Proposal preview">{preview}</div></CardContent>}
    <CardFooter className="flex-wrap justify-end gap-space-2">
      <Button onClick={() => { emit("proposal_kept", { proposal_id, proposal_type }); onKeep?.(); }}>Keep</Button>
      <Button variant="outline" onClick={() => { emit("proposal_dismissed", { proposal_id, proposal_type }); onDismiss?.(); }}>Dismiss</Button>
    </CardFooter>
  </Card>;
}
