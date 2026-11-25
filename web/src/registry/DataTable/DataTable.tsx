import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { events } from "./events";
import { propsSchema } from "./schema";
type Props = z.infer<typeof propsSchema>;
export function DataTable({ columns, rows, chartValues, form, state, onAction }: Props & { onAction?: (action: string, value?: string | number | boolean) => void }) {
  const capture = useCapture<(typeof events)[number]>();
  const root = useSkeletonCapture(capture, "DataTable", "default");
  const switchView = (to: "table" | "chart") => {
    if (form !== to) capture.emit("representation_switched", { dimension: "data_form", from: form, to });
    onAction?.("representation", to);
  };
  return <section ref={root} className="space-y-space-3">
    <ButtonGroup aria-label="Data representation">
      <Button variant={form === "table" ? "default" : "outline"} aria-pressed={form === "table"} onClick={() => switchView("table")}>Table</Button>
      <Button variant={form === "chart" ? "default" : "outline"} aria-pressed={form === "chart"} disabled={!chartValues?.length} onClick={() => switchView("chart")}>Chart</Button>
    </ButtonGroup>
    {state === "loading" ? <p aria-busy="true">Loading data</p> : state === "error" ? <p role="alert">Data could not be loaded</p> : state === "empty" || !rows.length ? <p>No data</p> : form === "chart" ? chartValues?.length ? <ItemGroup aria-label="Chart data">{chartValues.map((value, index) => <Item key={index}><ItemContent><ItemTitle>{rows[index]?.[0] ?? `Series ${index + 1}`}</ItemTitle><Progress max={Math.max(...chartValues, 1)} value={value} aria-label={`${rows[index]?.[0] ?? `Series ${index + 1}`} value`} /></ItemContent></Item>)}</ItemGroup> : <p>No chart data</p> : <Table><TableCaption>Data</TableCaption><TableHeader><TableRow>{columns.map((column) => <TableHead scope="col" key={column}>{column}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row, index) => <TableRow key={index}>{row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table>}
  </section>;
}
