import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCapture } from "../capture";
import { useSkeletonCapture } from "../capture-lifecycle";
import { DataChart } from "../DataChart/DataChart";
import { events } from "./events";
import { propsSchema } from "./schema";

type Props = z.infer<typeof propsSchema>;

export function DataTable({ columns, rows, renderedColumns, renderedRows, showEmptyHeaders = false, chartValues, form, state, onAction }: Props & { renderedColumns?: ReactNode[]; renderedRows?: ReactNode[][]; showEmptyHeaders?: boolean; onAction?: (action: string, value?: string | number | boolean) => void }) {
  const capture = useCapture<(typeof events)[number]>();
  const displayedState = state === "default"
    ? !columns.length || !rows.length && !showEmptyHeaders || form === "chart" && !chartValues?.length ? "empty" : form === "chart" ? "chart" : "table"
    : state;
  const displayedForm: "table" | "chart" | undefined = displayedState === "table" || displayedState === "chart" ? displayedState : undefined;
  const root = useSkeletonCapture(capture, "DataTable", displayedState);
  const previousForm = useRef(displayedForm);
  const emit = useRef(capture.emit);
  emit.current = capture.emit;
  const tableColumns = useMemo<ColumnDef<string[]>[]>(() => columns.map((column, index) => ({ id: String(index), accessorFn: (row) => row[index] ?? "", header: () => renderedColumns?.[index] ?? column })), [columns, renderedColumns]);
  const table = useReactTable({ data: rows, columns: tableColumns, getCoreRowModel: getCoreRowModel() });

  useEffect(() => {
    if (previousForm.current && displayedForm && previousForm.current !== displayedForm) emit.current("representation_switched", { dimension: "data_form", from: previousForm.current, to: displayedForm });
    previousForm.current = displayedForm;
  }, [displayedForm]);

  const switchView = (to: "table" | "chart") => onAction?.("representation", to);

  return <section ref={root} className="space-y-space-3">
    {rows.length > 0 && chartValues?.length ? <ButtonGroup aria-label="Data representation">
      <Button variant={form === "table" ? "default" : "outline"} aria-pressed={form === "table"} onClick={() => switchView("table")}>Table</Button>
      <Button variant={form === "chart" ? "default" : "outline"} aria-pressed={form === "chart"} onClick={() => switchView("chart")}>Chart</Button>
    </ButtonGroup> : null}
    {state === "loading" ? <p aria-busy="true">Loading data</p>
      : state === "error" ? <p role="alert">Data could not be loaded</p>
      : displayedState === "empty" || !columns.length ? <p>No data</p>
          : displayedForm === "chart" ? chartValues?.length
            ? <DataChart title={columns[1] ?? "Data"} labels={rows.map((row, index) => row[0] ?? `Series ${index + 1}`)} values={chartValues} chartType="bar" state="default" />
            : <p>No chart data</p>
            : <Table>
              <TableCaption>Data</TableCaption>
              <TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead scope="col" className={renderedColumns ? "whitespace-normal break-words" : "whitespace-nowrap"} key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
              <TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id}>{Array.from({ length: Math.max(columns.length, row.original.length) }, (_, index) => <TableCell className={renderedRows ? "whitespace-normal break-words" : "whitespace-nowrap"} key={index}>{renderedRows?.[row.index]?.[index] ?? row.original[index] ?? ""}</TableCell>)}</TableRow>)}</TableBody>
            </Table>}
  </section>;
}
