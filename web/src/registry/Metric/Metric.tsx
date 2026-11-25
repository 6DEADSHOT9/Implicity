import type { CSSProperties } from "react";
import type { z } from "zod";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
const surface: CSSProperties = { color: "var(--foreground)", backgroundColor: "var(--card)", padding: "var(--space-4)", borderRadius: "var(--radius)" };
export function Metric({ label, value, context, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "Metric", "default");
  return <section ref={root} aria-label={label} style={surface}>{state === "loading" ? <p aria-busy="true">Loading metric</p> : state === "error" ? <p role="alert">Metric could not be loaded</p> : <><h2>{label}</h2><p>{state === "empty" ? <span>—</span> : <data value={value}>{value}</data>}</p>{context && <p>{context}</p>}</>}</section>;
}
