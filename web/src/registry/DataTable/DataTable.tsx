import { useEffect, useMemo, useRef, useState } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
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

export function DataTable({ columns, rows, chartValues, form, state, onAction }: Props & { onAction?: (action: string, value?: string | number | boolean) => void }) {
  const capture = useCapture<(typeof events)[number]>();
  const displayedForm = (state === "default" || state === "long_content") && rows.length > 0 && (form !== "chart" || !!chartValues?.length) ? form : undefined;
  const root = useSkeletonCapture(capture, "DataTable", displayedForm ?? state);
  const previousForm = useRef(displayedForm);
  const emit = useRef(capture.emit);
  emit.current = capture.emit;
  const [sorting, setSorting] = useState<SortingState>([]);
  const data = useMemo(() => rows.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index] ?? ""]))), [columns, rows]);
  const tableColumns = useMemo<ColumnDef<Record<string, string>>[]>(() => columns.map((column) => ({ id: column, accessorFn: (row) => row[column] ?? "", header: column })), [columns]);
  const table = useReactTable({ data, columns: tableColumns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  useEffect(() => {
    if (previousForm.current && displayedForm && previousForm.current !== displayedForm) emit.current("representation_switched", { dimension: "data_form", from: previousForm.current, to: displayedForm });
    previousForm.current = displayedForm;
  }, [displayedForm]);

  const switchView = (to: "table" | "chart") => onAction?.("representation", to);

  return <section ref={root} className="space-y-space-3">
    <ButtonGroup aria-label="Data representation">
      <Button variant={form === "table" ? "default" : "outline"} aria-pressed={form === "table"} onClick={() => switchView("table")}>Table</Button>
      <Button variant={form === "chart" ? "default" : "outline"} aria-pressed={form === "chart"} disabled={!chartValues?.length} onClick={() => switchView("chart")}>Chart</Button>
    </ButtonGroup>
    {state === "loading" ? <p aria-busy="true">Loading data</p>
      : state === "error" ? <p role="alert">Data could not be loaded</p>
        : state === "empty" || !rows.length ? <p>No data</p>
          : form === "chart" ? chartValues?.length
            ? <DataChart title={columns[1] ?? "Data"} labels={rows.map((row, index) => row[0] ?? `Series ${index + 1}`)} values={chartValues} chartType="bar" state="default" />
            : <p>No chart data</p>
            : <Table>
              <TableCaption>Data</TableCaption>
              <TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead scope="col" key={header.id} aria-sort={header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : "none"}><button type="button" className="focus-ring-token rounded-sm" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}</button></TableHead>)}</TableRow>)}</TableHeader>
              <TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext()) ?? cell.getValue<string>()}</TableCell>)}</TableRow>)}</TableBody>
            </Table>}
  </section>;
}
