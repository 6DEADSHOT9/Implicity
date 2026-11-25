import type { CSSProperties } from "react";
import type { z } from "zod";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
const surface: CSSProperties = { color: "var(--foreground)", backgroundColor: "var(--card)", padding: "var(--space-4)", borderRadius: "var(--radius)" };
export function Checklist({ title, items, state, onAction }: Props & { onAction?: (action: string, value?: string | number | boolean) => void }) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "Checklist", "default");
  return <section ref={root} style={surface}><h2>{title}</h2>{state === "error" ? <p role="alert">Checklist could not be loaded</p> : state === "empty" || !items.length ? <p>No items</p> : <ul>{items.map(({ label, checked }, index) => <li key={`${label}-${index}`}><label><input type="checkbox" checked={checked} onChange={() => onAction?.("checklist_toggle", index)} style={{ width: "var(--target-min-size)", height: "var(--target-min-size)" }} />{label}</label></li>)}</ul>}</section>;
}
