import type { CSSProperties } from "react";
import type { z } from "zod";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
const surface: CSSProperties = { color: "var(--foreground)", backgroundColor: "var(--card)", padding: "var(--space-4)", borderRadius: "var(--radius)" };
export function DataChart({ title, labels, values, state }: Props) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "DataChart", "default");
  const chartMin = values.reduce((minimum, value) => Math.min(minimum, value), 0);
  const chartMax = values.reduce((maximum, value) => Math.max(maximum, value), 1);
  const content = state === "loading" ? <p aria-busy="true">Loading chart</p> : state === "error" ? <p role="alert">Chart could not be loaded</p> : !values.length || state === "empty" ? <p>No data</p> : <ul aria-label={title}>{values.map((value, index) => <li key={`${labels[index]}-${index}`}>{labels[index]}: <meter aria-label={labels[index] ?? "Data point"} min={chartMin} max={chartMax} value={value} style={{ accentColor: "var(--primary)" }}>{value}</meter></li>)}</ul>;
  return <figure ref={root} style={surface}><figcaption>{title}</figcaption>{content}</figure>;
}
