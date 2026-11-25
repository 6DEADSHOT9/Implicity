import { useEffect, useRef } from "react";
import { useCapture } from "../capture";
import { token } from "../token";
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
  const rootRef = useRef<HTMLElement>(null);
  emitRef.current = emit;
  useEffect(() => {
    emitRef.current("component_shown", { component: "Nudge", default_state: "prompt" });
    let timer: number | undefined;
    let seen = false;
    const reportSeen = () => {
      if (seen) return;
      seen = true;
      emitRef.current("component_seen", { component: "Nudge", default_state: "prompt", seconds_visible: 3 });
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
  }, []);

  return <aside ref={rootRef} style={{ display: "flex", flexDirection: "column", gap: token("--space-2"), borderRadius: token("--radius"), backgroundColor: token("--card"), color: token("--card-foreground"), padding: token("--space-4") }} role="status" aria-labelledby="nudge-title">
    <h2 style={{ fontSize: token("--text-base") }} id="nudge-title">{title}</h2>
    <p style={{ fontSize: token("--text-sm"), color: token("--muted-foreground") }}>{message}</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: token("--space-2") }}>
      <button style={{ minHeight: token("--target-min-size"), border: "none", borderRadius: token("--radius"), backgroundColor: token("--primary"), color: token("--primary-foreground"), fontFamily: "inherit", fontSize: token("--text-sm"), paddingInline: token("--space-4") }} type="button" onClick={onAction}>{actionLabel}</button>
      <button style={{ minHeight: token("--target-min-size"), border: "none", borderRadius: token("--radius"), backgroundColor: token("--secondary"), color: token("--secondary-foreground"), fontFamily: "inherit", fontSize: token("--text-sm"), paddingInline: token("--space-4") }} type="button" onClick={onLater}>Later</button>
    </div>
  </aside>;
}
