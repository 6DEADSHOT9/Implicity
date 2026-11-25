import type { CSSProperties } from "react";
import type { z } from "zod";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";

type Props = z.infer<typeof propsSchema>;
const surface: CSSProperties = { color: "var(--foreground)", backgroundColor: "var(--card)", padding: "var(--space-4)", borderRadius: "var(--radius)" };

export function DataTable({ columns, rows, chartValues, form, state, onAction }: Props & { onAction?: (action: string, value?: string | number | boolean) => void }) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "DataTable", "default");
  const view = form;
  const switchView = (to: "table" | "chart") => {
    if (view !== to) capture.emit("representation_switched", { dimension: "data_form", from: view, to });
    onAction?.("representation", to);
  };
  const chartMin = chartValues?.reduce((minimum, value) => Math.min(minimum, value), 0) ?? 0;
  const chartMax = chartValues?.reduce((maximum, value) => Math.max(maximum, value), 1) ?? 1;
  const content = state === "loading"
    ? <section aria-busy="true">Loading data</section>
    : state === "error"
      ? <section role="alert">Data could not be loaded</section>
      : state === "empty" || !rows.length
        ? <p>No data</p>
        : view === "table"
          ? <div role="region" aria-label="Data table" tabIndex={0}><table><caption>Data</caption><thead><tr>{columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>
          : chartValues?.length ? <ul aria-label="Chart data">{chartValues.map((value, index) => <li key={index}>{rows[index]?.[0] ?? `Series ${index + 1}`} <meter aria-label={rows[index]?.[0] ?? `Series ${index + 1}`} min={chartMin} max={chartMax} value={value} style={{ accentColor: "var(--primary)" }}>{value}</meter></li>)}</ul> : <p>No chart data</p>;
  return <div ref={root} style={surface}>
    <div role="group" aria-label="Data representation">
      <button type="button" aria-pressed={view === "table"} style={{ minHeight: "var(--target-min-size)" }} onClick={() => switchView("table")}>Table</button>
      <button type="button" aria-pressed={view === "chart"} disabled={!chartValues?.length} style={{ minHeight: "var(--target-min-size)" }} onClick={() => switchView("chart")}>Chart</button>
    </div>
    {content}
  </div>;
}
