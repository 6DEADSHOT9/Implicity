import type { CSSProperties } from "react";
import type { z } from "zod";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
const surface: CSSProperties = { color: "var(--foreground)", backgroundColor: "var(--card)", padding: "var(--space-4)", borderRadius: "var(--radius)" };
export function Tabs({ tabs, selected, state, onAction }: Props & { onAction?: (action: string, value?: string | number | boolean) => void }) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "Tabs", "default");
  const active = tabs.find(({ id }) => id === selected) ?? tabs[0];
  return <section ref={root} style={surface}>{state === "error" ? <p role="alert">Views could not be loaded</p> : state === "empty" ? <p>No views available</p> : <><div role="tablist" aria-label="Views">{tabs.map(({ id, label }) => <button type="button" role="tab" id={`tab-${id}`} aria-selected={id === active.id} aria-controls={`panel-${id}`} tabIndex={id === active.id ? 0 : -1} style={{ minHeight: "var(--target-min-size)" }} onClick={() => onAction?.("tab_select", id)} onKeyDown={(event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === id);
    const next = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]")[tabs.indexOf(next)]?.focus();
    onAction?.("tab_select", next.id);
   }} key={id}>{label}</button>)}</div><div role="tabpanel" id={`panel-${active.id}`} aria-labelledby={`tab-${active.id}`} tabIndex={0}>{active.content}</div></>}</section>;
}
