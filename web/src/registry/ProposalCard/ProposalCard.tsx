import { useEffect, useRef } from "react";
import { useCapture } from "../capture";
import { token } from "../token";
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
  const rootRef = useRef<HTMLElement>(null);
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

  return <section ref={rootRef} style={{ display: "flex", flexDirection: "column", gap: token("--space-3"), borderRadius: token("--radius"), backgroundColor: token("--card"), color: token("--card-foreground"), padding: token("--space-4") }} role="region" aria-labelledby="proposal-card-title">
    <h2 style={{ fontSize: token("--text-base") }} id="proposal-card-title">{title}</h2>
    <p style={{ fontSize: token("--text-sm"), color: token("--muted-foreground") }}>{description}</p>
    {preview && <div style={{ borderRadius: token("--radius-sm"), backgroundColor: token("--muted"), padding: token("--space-3") }} role="group" aria-label="Proposal preview">{preview}</div>}
    <div style={{ display: "flex", flexWrap: "wrap", gap: token("--space-2") }}>
      <button style={{ minHeight: token("--target-min-size"), border: "none", borderRadius: token("--radius"), backgroundColor: token("--primary"), color: token("--primary-foreground"), fontFamily: "inherit", fontSize: token("--text-sm"), paddingInline: token("--space-4") }} type="button" onClick={() => { emit("proposal_kept", { proposal_id, proposal_type }); onKeep?.(); }}>Keep</button>
      <button style={{ minHeight: token("--target-min-size"), border: "none", borderRadius: token("--radius"), backgroundColor: token("--secondary"), color: token("--secondary-foreground"), fontFamily: "inherit", fontSize: token("--text-sm"), paddingInline: token("--space-4") }} type="button" onClick={() => { emit("proposal_dismissed", { proposal_id, proposal_type }); onDismiss?.(); }}>Dismiss</button>
    </div>
  </section>;
}
